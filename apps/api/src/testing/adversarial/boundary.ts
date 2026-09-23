import { voiceClientEventSchema } from '@aria/shared';

import { scrubLearnerContext, scrubTextForModel } from '@/privacy';
import type { ParentAskFixture, RealtimeFixture } from '@/testing/adversarial/fixture.schema';

/**
 * The two boundaries that are not the turn path (X-05).
 *
 * A realtime frame is judged by whether it parses at all, because the worker's whole defence
 * is that an event the shared schema does not recognise never reaches the harness. A parent's
 * question is judged by what survives the scrubber, because the scrubber is the last thing
 * between free adult text and a vendor's logs.
 */
export type RealtimeOutcome = Readonly<{
  fixtureId: string;
  accepted: boolean;
  /** What the payload was, in bytes, so an oversized case can prove it was oversized. */
  bytes: number;
}>;

export type ParentAskOutcome = Readonly<{
  fixtureId: string;
  /** The text as a vendor would receive it. */
  outbound: string;
}>;

const encoder = new TextEncoder();

export function replayRealtimeFixture(fixture: RealtimeFixture): RealtimeOutcome {
  const payload = payloadOf(fixture);
  return {
    fixtureId: fixture.id,
    accepted: voiceClientEventSchema.safeParse(decode(payload)).success,
    bytes: payload.byteLength,
  };
}

export function replayParentAskFixture(fixture: ParentAskFixture): ParentAskOutcome {
  // The context a parent's question would be answered against: a real scrubbed context, built
  // the only way one can be built, because `scrubTextForModel` refuses anything else.
  const context = scrubLearnerContext(
    { identifiers: {}, gradeBand: 'middle' },
    { pseudonym: 'omit' },
  );
  return { fixtureId: fixture.id, outbound: scrubTextForModel(context, fixture.text) };
}

/**
 * `repeatToBytes` builds the oversized cases here rather than in the file.
 *
 * A fixture file holding a literal megabyte of `a` is a fixture file nobody can read, review
 * or diff — so the file says how big, and this makes it that big.
 */
function payloadOf(fixture: RealtimeFixture): Uint8Array {
  const frame = fixture.frame;
  const text = typeof frame === 'string' ? frame : JSON.stringify(frame ?? null);
  if (fixture.repeatToBytes === undefined) return encoder.encode(text);
  return encoder.encode(text.replace('__FILL__', 'a'.repeat(fixture.repeatToBytes)));
}

function decode(payload: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(payload));
  } catch {
    return undefined;
  }
}
