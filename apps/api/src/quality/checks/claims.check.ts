import type { Band } from '@aria/shared';

import { failedMany, passed } from '@/quality/checks/check-result';
import { EMPTY_PRAISE, STRATEGY_CLAIMS } from '@/quality/checks/claims/claim-vocabulary.data';
import { sentencesOf } from '@/quality/checks/level/readability';
import type {
  GateCheckResult,
  GateFailureReason,
  GateInput,
  MoveClaims,
} from '@/quality/gate.types';

const MAX_END_SENTENCES = 3;
/** P2H-11: an early-band ending is spoken to a five-year-old, so it is short as well as brief. */
const MAX_EARLY_END_WORDS = 20;
const MIN_REVEAL_SENTENCES = 2;
const DIGITS = /\d/u;
const PERCENT = /\bpercent\b|%/u;

/**
 * Is this move honest about what happened, and does it say what it exists to say (P2H-11)?
 *
 * The other checks ask whether a sentence is safe, readable and well formed. None of them can
 * tell that a praise names a strategy the child never used, that a reveal never got round to
 * the answer, or that an ending recited a score. Those are the three ways these moves go wrong
 * in front of a child, and all three are decidable from the turn, so none is left to a prompt.
 *
 * Runs only when the caller supplies `claims`. Text with no claims to check passes untouched.
 */
export function checkClaims(input: GateInput): GateCheckResult {
  const claims = input.claims;
  if (claims === undefined) return passed('claims');
  // Grounding is a praise problem, not a general one: only praise claims that the *child* did
  // something. A reveal explaining that the pieces have to be the same size is describing the
  // maths, and refusing it would be refusing the one thing a reveal exists to do.
  const reasons: Omit<GateFailureReason, 'check'>[] = [
    ...(claims.move === 'praise' ? ungrounded(input.childText, claims.allowed) : []),
    ...moveRules(input.childText, claims, input.band),
  ];
  return reasons.length === 0 ? passed('claims') : failedMany('claims', reasons);
}

/** Every strategy the text claims that this turn did not see the child use. */
function ungrounded(
  text: string,
  allowed: readonly string[],
): readonly Omit<GateFailureReason, 'check'>[] {
  return STRATEGY_CLAIMS.filter(
    (claim) => !allowed.includes(claim.id) && claim.cues.some((cue) => cue.test(text)),
  ).map((claim) => ({
    code: 'ungrounded',
    message: `Nothing this turn shows the child ${claim.says}.`,
  }));
}

function moveRules(
  text: string,
  claims: MoveClaims,
  band: Band,
): readonly Omit<GateFailureReason, 'check'>[] {
  if (claims.move === 'praise') return emptyPraise(text);
  if (claims.move === 'end') return endRules(text, band);
  return revealRules(text, claims);
}

function emptyPraise(text: string): readonly Omit<GateFailureReason, 'check'>[] {
  const hit = EMPTY_PRAISE.find((phrase) => phrase.test(text.toLowerCase()));
  if (hit === undefined) return [];
  return [
    {
      code: 'empty_praise',
      message: 'Praise names what the child did, never how good or how clever they are.',
    },
  ];
}

function endRules(text: string, band: Band): readonly Omit<GateFailureReason, 'check'>[] {
  const reasons: Omit<GateFailureReason, 'check'>[] = [];
  if (DIGITS.test(text) || PERCENT.test(text.toLowerCase())) {
    reasons.push({ code: 'scored_ending', message: 'An ending names the work, not a score.' });
  }
  if (sentencesOf(text).length > MAX_END_SENTENCES) {
    reasons.push({
      code: 'ending_too_long',
      message: `An ending is at most ${String(MAX_END_SENTENCES)} sentences.`,
    });
  }
  if (band === 'early' && wordCount(text) > MAX_EARLY_END_WORDS) {
    reasons.push({
      code: 'ending_too_long_for_band',
      message: `An early-band ending is at most ${String(MAX_EARLY_END_WORDS)} words.`,
    });
  }
  return reasons;
}

function wordCount(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/u).length;
}

function revealRules(
  text: string,
  claims: MoveClaims,
): readonly Omit<GateFailureReason, 'check'>[] {
  const reasons: Omit<GateFailureReason, 'check'>[] = (claims.mustMention ?? [])
    .filter((requirement) => !requirement.any.some((option) => contains(text, option)))
    .map((requirement) => ({ code: requirement.code, message: requirement.message }));
  if (sentencesOf(text).length < MIN_REVEAL_SENTENCES) {
    reasons.push({
      code: 'missing_reasoning',
      message: 'A reveal states the answer and then says why it is the answer.',
    });
  }
  return reasons;
}

function contains(text: string, option: string): boolean {
  return text.toLowerCase().includes(option.toLowerCase());
}
