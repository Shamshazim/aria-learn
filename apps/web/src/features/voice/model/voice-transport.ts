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
