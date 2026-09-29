import { voiceClientEventSchema, type VoiceClientEvent } from '@aria/shared';

/**
 * The gate on the data channel: nothing reaches the harness that did not parse (X-05).
 *
 * Refusing a malformed event is only half the job — the worker did that already, silently. A
 * client that sends one bad frame has a bug; a client that sends ten thousand is
 * either broken in a loop or is not our client at all, and either way the room is costing a
 * worker its attention for nothing. So invalid frames are counted in a sliding window and the
 * session is ended once the window fills.
 *
 * The window matters. A count that only ever went up would eventually close a session that
 * saw one bad frame an hour for a day — a child mid-sentence, disconnected because of a bug
 * that never actually cost anything.
 */
export type EventRejection = 'oversized' | 'not-json' | 'not-an-event';

export type EventValidator = Readonly<{
  /** The event, or `null` if it was rejected — including every frame after a disconnect. */
  accept(payload: Uint8Array): VoiceClientEvent | null;
  /** What has been dropped, for the run log and for a test to assert on. */
  counts(): Readonly<{ accepted: number; rejected: Readonly<Record<EventRejection, number>> }>;
  /** True once the threshold was crossed; the room is being torn down. */
  isClosed(): boolean;
}>;

/**
 * A generous ceiling: the largest legitimate event is a `SCREEN_ANSWER` capped at 4 000
 * characters by the schema, so 16KB is roughly four times the worst honest frame and still
 * small enough that a flood cannot be turned into memory pressure through this path.
 */
const MAX_PAYLOAD_BYTES = 16 * 1_024;
const MAX_INVALID = 20;
const WINDOW_MS = 10_000;

export function createEventValidator(
  input: Readonly<{
    /** Ends the session. Called once, when the window fills. */
    onAbuse(reason: Readonly<{ rejected: number; withinMs: number }>): void;
    maxInvalid?: number;
    windowMs?: number;
    maxPayloadBytes?: number;
    now?(): number;
  }>,
): EventValidator {
  const maxInvalid = input.maxInvalid ?? MAX_INVALID;
  const windowMs = input.windowMs ?? WINDOW_MS;
  const maxPayloadBytes = input.maxPayloadBytes ?? MAX_PAYLOAD_BYTES;
  const now = input.now ?? (() => Date.now());
  const decoder = new TextDecoder();

  let accepted = 0;
  let closed = false;
  const rejected: Record<EventRejection, number> = {
    oversized: 0,
    'not-json': 0,
    'not-an-event': 0,
  };
  let recent: number[] = [];

  const reject = (reason: EventRejection): null => {
    rejected[reason] += 1;
    const at = now();
    recent = [...recent.filter((stamp) => at - stamp < windowMs), at];
    if (!closed && recent.length >= maxInvalid) {
      closed = true;
      input.onAbuse({ rejected: recent.length, withinMs: windowMs });
    }
    return null;
  };

  return {
    isClosed: () => closed,
    counts: () => ({ accepted, rejected: { ...rejected } }),
    accept: (payload) => {
      // Once the session is being torn down there is nothing left to deliver an event to, and
      // counting further frames would only inflate a number nobody will act on.
      if (closed) return null;
      if (payload.byteLength > maxPayloadBytes) return reject('oversized');
      const parsed = parseJson(decoder, payload);
      if (parsed === NOT_JSON) return reject('not-json');
      const event = voiceClientEventSchema.safeParse(parsed);
      if (!event.success) return reject('not-an-event');
      accepted += 1;
      return event.data;
    },
  };
}

/** A sentinel rather than `null`, because `null` is itself valid JSON and must be rejected. */
const NOT_JSON = Symbol('not-json');

function parseJson(decoder: TextDecoder, payload: Uint8Array): unknown {
  try {
    return JSON.parse(decoder.decode(payload));
  } catch {
    return NOT_JSON;
  }
}
