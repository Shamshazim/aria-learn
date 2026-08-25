import type { SegmentOrder } from '@/session/segment-order';
import { createSegmentOrder } from '@/session/segment-order';

/**
 * What one voice connection remembers between turns (P2-13, P2H-07).
 *
 * It is deliberately dumb: sequence numbers, the generation currently being spoken, and the
 * sentence ordering for it. Every decision about what any of that means lives in
 * `move-stream.ts`; this is only the place those facts survive a turn.
 */
export type MoveStreamState = Readonly<{
  acknowledgedSeq(): number;
  acknowledge(serverSeq: number): void;
  deliveredSeq(): number;
  markDelivered(serverSeq: number): void;
  activeGenerationId(): string | null;
  activate(generationId: string | null): void;
  terminalSpeechPending(): boolean;
  terminalDelivered(): boolean;
  markTerminalSpeechPending(pending: boolean): void;
  pendingPlaybackSeq(): number;
  markPendingPlayback(serverSeq: number): void;
  takePendingPlaybackSeq(): number;
  /** P2H-07: puts streamed sentences back in order, and remembers which moves they were. */
  order: SegmentOrder;
}>;

export function createMoveStreamState(): MoveStreamState {
  let acknowledgedSeq = 0;
  let deliveredSeq = 0;
  let activeGenerationId: string | null = null;
  let terminalSpeechPending = false;
  let terminalDelivered = false;
  let pendingPlaybackSeq = 0;
  const order = createSegmentOrder();
  return {
    order,
    acknowledgedSeq: () => acknowledgedSeq,
    acknowledge: (serverSeq) => {
      acknowledgedSeq = Math.max(acknowledgedSeq, serverSeq);
    },
    deliveredSeq: () => deliveredSeq,
    markDelivered: (serverSeq) => {
      deliveredSeq = Math.max(deliveredSeq, serverSeq);
    },
    activeGenerationId: () => activeGenerationId,
    activate: (generationId) => {
      activeGenerationId = generationId;
    },
    terminalSpeechPending: () => terminalSpeechPending,
    terminalDelivered: () => terminalDelivered,
    markTerminalSpeechPending: (pending) => {
      terminalDelivered = true;
      terminalSpeechPending = pending;
    },
    pendingPlaybackSeq: () => pendingPlaybackSeq,
    markPendingPlayback: (serverSeq) => {
      pendingPlaybackSeq = Math.max(pendingPlaybackSeq, serverSeq);
    },
    takePendingPlaybackSeq: () => {
      const result = pendingPlaybackSeq;
      pendingPlaybackSeq = 0;
      return result;
    },
  };
}
