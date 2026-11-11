import type { EngagementStateKind } from '@aria/shared';

import { isContradiction, isExplicit, supportedState, weightAlone } from './signals';
import { STATE_LIFETIME_MS } from './thresholds';

import type { EngagementSignal, EngagementState } from './types';

/** When two states are equally supported, the one that most needs a response wins. */
const SEVERITY: readonly EngagementStateKind[] = ['tired', 'frustrated', 'disengaged', 'uncertain'];

const EXPLICIT_CONFIDENCE = 0.9;
const TWO_AGREE = 0.6;
const THREE_AGREE = 0.8;
/** What one contradicting signal takes off a state it came after. */
const CONTRADICTION = 0.2;

export const READY: EngagementState = {
  kind: 'ready',
  confidence: 0,
  evidence: [],
  expiresAt: null,
};

export type FoldInput = Readonly<{
  signals: readonly EngagementSignal[];
  now: Date;
  /** States the child has said are wrong this session; never inferred again. */
  denied?: readonly EngagementStateKind[];
}>;

/**
 * The engagement state the evidence supports (P3-05, `master-plan.md` §4.3).
 *
 * Confidence comes from how much evidence there is and whether it agrees, never from a model:
 * one signal is worth at most 0.4, two that agree 0.6, three 0.8, and the child saying so 0.9.
 * A contradicting signal after the evidence takes 0.2 off. "I'm fine" clears everything
 * before it. Of two explicit statements the latest wins.
 *
 * Order-insensitive: signals are sorted by time first, so a reconnect that delivers them out
 * of order changes nothing. Only the last five minutes count — a state lasts five minutes
 * past its last supporting signal and is gone after that.
 */
export function fold(input: FoldInput): EngagementState {
  const live = sinceLastClear(window(input.signals, input.now));
  const denied = new Set(input.denied ?? []);
  const explicit = latestExplicit(live, denied);
  if (explicit !== null) return explicit;
  const candidates = SEVERITY.filter((kind) => !denied.has(kind)).map((kind) =>
    inferred(kind, live),
  );
  const best = candidates.reduce<EngagementState>(
    (winner, next) => (next.confidence > winner.confidence ? next : winner),
    READY,
  );
  return best.confidence > 0 ? best : READY;
}

function window(signals: readonly EngagementSignal[], now: Date): readonly EngagementSignal[] {
  const from = now.getTime() - STATE_LIFETIME_MS;
  return signals
    .filter((signal) => signal.at.getTime() > from && signal.at.getTime() <= now.getTime())
    .sort((left, right) => left.at.getTime() - right.at.getTime());
}

/** Everything after the child last said they were fine. */
function sinceLastClear(signals: readonly EngagementSignal[]): readonly EngagementSignal[] {
  const last = signals.map((signal) => signal.name).lastIndexOf('said_fine');
  return last < 0 ? signals : signals.slice(last + 1);
}

function latestExplicit(
  signals: readonly EngagementSignal[],
  denied: ReadonlySet<EngagementStateKind>,
): EngagementState | null {
  const statement = [...signals].reverse().find((signal) => {
    const kind = supportedState(signal);
    return isExplicit(signal) && kind !== null && !denied.has(kind);
  });
  const kind = statement === undefined ? null : supportedState(statement);
  if (statement === undefined || kind === null) return null;
  const after = contradictionsAfter(signals, statement.at);
  return state(kind, EXPLICIT_CONFIDENCE - after * CONTRADICTION, [statement]);
}

function inferred(
  kind: EngagementStateKind,
  signals: readonly EngagementSignal[],
): EngagementState {
  const supporting = signals.filter((signal) => supportedState(signal) === kind);
  const first = supporting[0];
  const last = supporting.at(-1);
  if (first === undefined || last === undefined) return { ...READY, kind };
  // "Uncertain" is the one a single good answer settles: the child knew it after all.
  if (kind === 'uncertain' && contradictionsAfter(signals, last.at) > 0) return { ...READY, kind };
  const base =
    supporting.length === 1
      ? weightAlone(first)
      : supporting.length === 2
        ? TWO_AGREE
        : THREE_AGREE;
  return state(kind, base - contradictionsAfter(signals, first.at) * CONTRADICTION, supporting);
}

function contradictionsAfter(signals: readonly EngagementSignal[], at: Date): number {
  return signals.filter((signal) => isContradiction(signal) && signal.at.getTime() > at.getTime())
    .length;
}

function state(
  kind: EngagementStateKind,
  confidence: number,
  evidence: readonly EngagementSignal[],
): EngagementState {
  const last = evidence.at(-1);
  const bounded = Math.round(Math.min(EXPLICIT_CONFIDENCE, Math.max(0, confidence)) * 100) / 100;
  return {
    kind,
    confidence: bounded,
    evidence,
    expiresAt: last === undefined ? null : new Date(last.at.getTime() + STATE_LIFETIME_MS),
  };
}
