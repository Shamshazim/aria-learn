import type { VoiceClientEvent, VoiceWorkerState } from '@aria/shared';

export function workerReadyAcknowledgement(
  state: VoiceWorkerState,
  enabled: boolean,
  acknowledgedSeq: number,
): VoiceClientEvent | null {
  if (state.kind !== 'WORKER_READY' || !enabled) return null;
  return { kind: 'ACK', acknowledgedSeq };
}
