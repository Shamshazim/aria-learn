import { ConnectionState, type Room } from 'livekit-client';
import { useCallback, useEffect } from 'react';

import type { TutorMove } from '@aria/shared';

import {
  publishClientEvent,
  publishScreenAnswer,
  publishScreenSkip,
} from '@/features/voice/model/voice-transport';

/**
 * The screen's side of the conversation with the voice ("Aria talks").
 *
 * Four things the browser tells the worker over the room: a move it rendered on its own
 * (`SYNC`), an answer the child gave on the screen (`SCREEN_ANSWER`), a skip
 * (`SCREEN_SKIP`), and the end of the session (`LEAVE`). Everything the voice tells the
 * screen comes the other way as moves and worker states, through `useRealtimeVoice`.
 */
type BridgeRefs = Readonly<{
  room: React.RefObject<Room | null>;
  enabled: React.RefObject<boolean>;
  /** True where a realtime model is the voice; only then does the screen answer through it. */
  talks: React.RefObject<boolean>;
}>;

export type ScreenBridge = Readonly<{
  syncMove(move: TutorMove): Promise<void>;
  /** Returns false when there is no talking voice to give the answer to. */
  answerOnScreen(moveId: string, text: string): Promise<boolean>;
  /** Returns false when there is no talking voice to tell; the caller skips through the API. */
  skipOnScreen(moveId: string): Promise<boolean>;
}>;

/** "End session" on the screen reaches a talking voice, so she says goodbye rather than carrying on. */
export function useLeaveOnEnd(ended: boolean, refs: BridgeRefs): void {
  const { room, enabled, talks } = refs;
  useEffect(() => {
    const activeRoom = room.current;
    if (!ended || !talks.current || !enabled.current || activeRoom === null) return;
    if (activeRoom.state !== ConnectionState.Connected) return;
    void publishClientEvent(activeRoom, { kind: 'LEAVE' }).catch(() => undefined);
  }, [enabled, ended, room, talks]);
}

/** The screen's messages to the voice: a move it rendered itself, an answer, a skip. */
export function useScreenBridge(refs: BridgeRefs, renderedMoves: Set<string>): ScreenBridge {
  const { room, enabled, talks } = refs;
  const syncMove = useCallback(
    async (move: TutorMove) => {
      renderedMoves.add(move.id);
      const activeRoom = room.current;
      if (enabled.current && activeRoom?.state === ConnectionState.Connected) {
        await publishClientEvent(activeRoom, { kind: 'SYNC' });
      }
    },
    [enabled, renderedMoves, room],
  );
  const talkingRoom = useCallback((): Room | null => {
    const activeRoom = room.current;
    if (!talks.current || !enabled.current || activeRoom?.state !== ConnectionState.Connected) {
      return null;
    }
    return activeRoom;
  }, [enabled, room, talks]);
  const answerOnScreen = useCallback(
    async (moveId: string, text: string) => {
      const activeRoom = talkingRoom();
      if (activeRoom === null) return false;
      await publishScreenAnswer(activeRoom, moveId, text);
      return true;
    },
    [talkingRoom],
  );
  const skipOnScreen = useCallback(
    async (moveId: string) => {
      const activeRoom = talkingRoom();
      if (activeRoom === null) return false;
      await publishScreenSkip(activeRoom, moveId);
      return true;
    },
    [talkingRoom],
  );
  return { syncMove, answerOnScreen, skipOnScreen };
}
