import type { EngagementStateKind } from '@aria/shared';

import type { EngagementSignal, EngagementSignalName } from './types';

/**
 * Which state each signal is evidence for, and how much one of them alone is worth (P3-05).
 *
 * The weights cap what a single signal can claim. An explicit statement is 0.9 — the child
 * told us. A tab gone quiet for half a minute is 0.4, enough to ask "still with me?" when
 * they come back. Everything else a single time is 0.3, below the 0.4 at which Aria asks:
 * a slow answer, a run of wrong ones, a short reply, a few silences are each ordinary, and a
 * wrong-answer run already has its own ladder. Two of them agreeing is a different matter.
 */
type Meaning = Readonly<{ supports: EngagementStateKind | 'contradicts'; alone: number }>;

const MEANING: Readonly<Record<EngagementSignalName, Meaning | null>> = {
  latency_slow: { supports: 'uncertain', alone: 0.3 },
  errors_repeated: { supports: 'frustrated', alone: 0.3 },
  silence: { supports: 'disengaged', alone: 0.3 },
  short_answers: { supports: 'disengaged', alone: 0.3 },
  tab_hidden: { supports: 'disengaged', alone: 0.3 },
  idle: { supports: 'disengaged', alone: 0.4 },
  stop_request: { supports: 'tired', alone: 0.9 },
  said_tired: { supports: 'tired', alone: 0.9 },
  said_bored: { supports: 'disengaged', alone: 0.9 },
  said_frustrated: { supports: 'frustrated', alone: 0.9 },
  // Resolved per signal, from what the worker heard (`supportedState`).
  vocal_cue: null,
  answered_well: { supports: 'contradicts', alone: 0 },
  said_fine: { supports: 'contradicts', alone: 0 },
};

const EXPLICIT: ReadonlySet<EngagementSignalName> = new Set([
  'stop_request',
  'said_tired',
  'said_bored',
  'said_frustrated',
]);

/** The state this signal supports, or `null` for one that argues against a state. */
export function supportedState(signal: EngagementSignal): EngagementStateKind | null {
  if (signal.name === 'vocal_cue') return signal.suggests ?? null;
  const supports = MEANING[signal.name]?.supports ?? 'contradicts';
  return supports === 'contradicts' ? null : supports;
}

export function weightAlone(signal: EngagementSignal): number {
  if (signal.name === 'vocal_cue') return 0.3;
  return MEANING[signal.name]?.alone ?? 0;
}

export function isExplicit(signal: EngagementSignal): boolean {
  return EXPLICIT.has(signal.name);
}

export function isContradiction(signal: EngagementSignal): boolean {
  return signal.name === 'answered_well' || signal.name === 'said_fine';
}
