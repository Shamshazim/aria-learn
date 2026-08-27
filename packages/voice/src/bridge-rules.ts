import type { Band, TutorMove } from '@aria/shared';
import type { Intent } from '@aria/tutor';

import { BRIDGE_BUCKETS, bucketFor, type BridgeBucket } from './bridge-buckets';

/**
 * Why a bridge did not play. Every one of these is a counter label, so a deployment can see
 * which rule is doing the silencing rather than guessing why Aria went quiet.
 */
export const BRIDGE_SKIP_RULES = [
  'segment-imminent',
  'back-to-back',
  'child-speaking',
  'fixed-response',
  'band-cadence',
  'no-clip',
] as const;

export type BridgeSkipRule = (typeof BRIDGE_SKIP_RULES)[number];

export type BridgeDecision =
  Readonly<{ play: true; bucket: BridgeBucket }> | Readonly<{ play: false; rule: BridgeSkipRule }>;

/**
 * Below this, the real answer is already on its way and a bridge would be talking over it.
 * P2H-07 made the gap short; this is where "short enough" is written down.
 */
export const BRIDGE_FLOOR_MS = 400;

/**
 * Turns that must pass between two bridges.
 *
 * One. Rule 2 ("never two in a row") and rule 6's early-band cadence ("at most every other
 * turn") are the same number today; they are written as two rules because they answer to
 * different things — the ladder and the band — and only one of them would move.
 */
const MIN_TURNS_BETWEEN = 1;

export type BridgeContext = Readonly<{
  intent: Intent;
  band: Band;
  /** The move the child was replying to, or `null` on the first turn of a session. */
  afterMoveKind: TutorMove['kind'] | null;
  /** P2H-07's measured estimate for this session; `null` until enough turns have been timed. */
  expectedFirstAudioMs: number | null;
  /** The child started speaking again after their transcript closed (rule 3). */
  childSpeaking: boolean;
  /** Turns between now and the last bridge; `null` when this session has played none. */
  turnsSinceBridge: number | null;
}>;

/**
 * P2H-09 rules 1–6, in the order that keeps a wrong answer harmless.
 *
 * Rule 4 comes first because it is the only one about what Aria is *about to say*: those turns
 * answer from fixed text, so a bridge in front of one is pure delay. Rule 3 comes next because
 * a child who is still talking must never be spoken over, whatever the timings say.
 */
export function decideBridge(context: BridgeContext): BridgeDecision {
  const bucket = bucketFor(context);
  if (bucket === null) return { play: false, rule: 'fixed-response' };
  if (context.childSpeaking) return { play: false, rule: 'child-speaking' };
  if (context.expectedFirstAudioMs !== null && context.expectedFirstAudioMs < BRIDGE_FLOOR_MS) {
    return { play: false, rule: 'segment-imminent' };
  }
  if (context.turnsSinceBridge !== null && context.turnsSinceBridge < MIN_TURNS_BETWEEN) {
    return { play: false, rule: 'back-to-back' };
  }
  const cadence = bandCadence(context, bucket);
  return cadence === null ? { play: true, bucket } : { play: false, rule: cadence };
}

/**
 * Rule 6, the band clause.
 *
 * The oldest children get one bucket — "let me think" — because everything else sounds like
 * filler to them. The early band's half of the rule ("at most every other turn") asks for
 * exactly the cadence rule 2 already enforces on every band, so it is not written twice; if
 * rule 2 is ever relaxed for older children, the early floor becomes a rule of its own here.
 */
function bandCadence(context: BridgeContext, bucket: BridgeBucket): BridgeSkipRule | null {
  return playableBuckets(context.band).includes(bucket) ? null : 'band-cadence';
}

/**
 * Which buckets a band can ever hear, so nobody records clips it will never play.
 *
 * The seed files and the synthesiser both read this rather than listing buckets of their own:
 * a bucket the rules will not play is a clip nobody should have to sit and review.
 */
export function playableBuckets(band: Band): readonly BridgeBucket[] {
  return band === 'senior' ? ['thinking'] : BRIDGE_BUCKETS;
}
