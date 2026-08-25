import type { GatedSegment } from '@/ai';

/**
 * P2H-07: where a gated sentence goes while the turn it belongs to is still running.
 *
 * The tutor harness resolves a whole turn and then commits it; that contract is what makes a
 * turn replayable, and streaming does not get to change it. So the sentences travel beside the
 * turn rather than through it: the content service publishes each one as it passes the gate,
 * and the controller holding the child's open connection writes it out. When the turn finishes,
 * the moves go back the ordinary way.
 *
 * Subscriptions are per session and last exactly as long as one request. A turn with no
 * listener publishes into nothing, which is what a buffered client should see.
 */
export type SegmentListener = (segment: GatedSegment) => void;

export type SegmentBus = Readonly<{
  publish(sessionId: string, segment: GatedSegment): void;
  subscribe(sessionId: string, listener: SegmentListener): () => void;
  listening(sessionId: string): boolean;
}>;

export function createSegmentBus(): SegmentBus {
  const listeners = new Map<string, Set<SegmentListener>>();
  return {
    publish: (sessionId, segment) => {
      for (const listener of listeners.get(sessionId) ?? []) listener(segment);
    },
    subscribe: (sessionId, listener) => {
      const existing = listeners.get(sessionId) ?? new Set<SegmentListener>();
      existing.add(listener);
      listeners.set(sessionId, existing);
      return () => {
        existing.delete(listener);
        if (existing.size === 0) listeners.delete(sessionId);
      };
    },
    listening: (sessionId) => (listeners.get(sessionId)?.size ?? 0) > 0,
  };
}
