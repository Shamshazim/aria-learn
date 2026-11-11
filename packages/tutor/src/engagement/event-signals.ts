import type { Band, TutorInputEvent } from '@aria/shared';

import { statementSignal } from './statements';
import { ENGAGEMENT_THRESHOLDS, IDLE_MS, TAB_HIDDEN_MIN_MS } from './thresholds';

import type { EngagementSignal } from './types';

/** What the turn knows about the question an answer was for. */
export type AnswerSetting = Readonly<{
  band: Band;
  /** The `expects` of the move answered; `none` and `drag` never make a latency signal. */
  expects: string | null;
  /** The question had no single right answer, so a one-word reply means something. */
  openQuestion: boolean;
}>;

const NO_LATENCY: ReadonlySet<string> = new Set(['none', 'drag']);

/**
 * The passive signals one event carries (P3-05): how slow, how short, a hidden tab. Never what
 * the answer was worth — grading decides that, and it happens after this.
 *
 * Used for the event being handled and, by the API, for every earlier event in the log, so a
 * signal means the same thing whenever it is read.
 */
export function eventSignals(
  event: TutorInputEvent,
  setting: AnswerSetting,
): readonly EngagementSignal[] {
  const at = new Date(event.at);
  if (event.kind === 'ENGAGEMENT_SIGNAL') return clientSignal(event, at);
  if (event.kind !== 'ANSWER' && event.kind !== 'SPEECH_FINAL') return [];
  const signals: EngagementSignal[] = [];
  const bar = ENGAGEMENT_THRESHOLDS[setting.band];
  const elapsed = event.kind === 'ANSWER' ? event.elapsedMs : undefined;
  if (
    elapsed !== undefined &&
    elapsed > bar.latencySlowMs &&
    setting.expects !== null &&
    !NO_LATENCY.has(setting.expects)
  ) {
    signals.push({ name: 'latency_slow', at });
  }
  const text = event.text;
  if (setting.openQuestion && text !== undefined && words(text) < bar.shortAnswerWords) {
    signals.push({ name: 'short_answers', at });
  }
  return signals;
}

/**
 * What a graded answer adds (P3-05): a run of wrong answers is evidence of frustration, and a
 * right answer at a normal pace argues against every state but tiredness.
 */
export function gradedSignals(
  graded: Readonly<{ correct: boolean }>,
  input: Readonly<{ band: Band; wrongBefore: number; slow: boolean; at: Date }>,
): readonly EngagementSignal[] {
  if (graded.correct) return input.slow ? [] : [{ name: 'answered_well', at: input.at }];
  const run = input.wrongBefore + 1;
  return run >= ENGAGEMENT_THRESHOLDS[input.band].errorRun
    ? [{ name: 'errors_repeated', at: input.at }]
    : [];
}

/** A statement about the child in what they said, if there is one. */
export function utteranceStatement(event: TutorInputEvent): EngagementSignal | null {
  if (event.kind === 'SPEECH_FINAL') return statementSignal(event.text, new Date(event.at));
  if (event.kind === 'ANSWER' && event.text !== undefined) {
    return statementSignal(event.text, new Date(event.at));
  }
  return null;
}

function clientSignal(
  event: Extract<TutorInputEvent, { kind: 'ENGAGEMENT_SIGNAL' }>,
  at: Date,
): readonly EngagementSignal[] {
  if (event.signal === 'vocal_cue') {
    return event.suggests === undefined
      ? []
      : [{ name: 'vocal_cue', at, suggests: event.suggests }];
  }
  const hidden = event.hiddenMs ?? (event.signal === 'idle' ? IDLE_MS : 0);
  // A notification banner is not a child walking away.
  if (hidden < TAB_HIDDEN_MIN_MS) return [];
  return [{ name: hidden >= IDLE_MS ? 'idle' : 'tab_hidden', at }];
}

function words(text: string): number {
  return text
    .trim()
    .split(/\s+/u)
    .filter((word) => word !== '').length;
}
