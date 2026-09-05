import { ConnectionState, type Room } from 'livekit-client';

import type { VoiceClientEvent } from '@aria/shared';

const encoder = new TextEncoder();

export function readAcknowledgedSeq(sessionId: string): number {
  const parsed = Number.parseInt(sessionStorage.getItem(acknowledgementKey(sessionId)) ?? '0', 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function storeAcknowledgedSeq(sessionId: string, serverSeq: number): void {
  sessionStorage.setItem(acknowledgementKey(sessionId), String(serverSeq));
}

export async function publishAcknowledgement(room: Room, acknowledgedSeq: number): Promise<void> {
  if (room.state !== ConnectionState.Connected) return;
  await publishClientEvent(room, { kind: 'ACK', acknowledgedSeq });
}

/** "Aria talks": a tap or some typing on the screen, handed to the voice so she knows at once. */
export async function publishScreenAnswer(room: Room, moveId: string, text: string): Promise<void> {
  await publishClientEvent(room, { kind: 'SCREEN_ANSWER', moveId, text });
}

/** "Aria talks": the child pressed skip on the screen, so the voice closes the question too. */
export async function publishScreenSkip(room: Room, moveId: string): Promise<void> {
  await publishClientEvent(room, { kind: 'SCREEN_SKIP', moveId });
}

export async function publishClientEvent(room: Room, event: VoiceClientEvent): Promise<void> {
  await room.localParticipant.publishData(encoder.encode(JSON.stringify(event)), {
    reliable: true,
    topic: 'aria.client-event',
  });
}

export async function microphones(): Promise<readonly MediaDeviceInfo[]> {
  return (await navigator.mediaDevices.enumerateDevices()).filter(
    (device) => device.kind === 'audioinput',
  );
}

function acknowledgementKey(sessionId: string): string {
  return `aria.voice.ack.${sessionId}`;
}
