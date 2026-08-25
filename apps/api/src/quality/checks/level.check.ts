import type { Band } from '@aria/shared';

import { failedMany, passed } from '@/quality/checks/check-result';
import { childFacingText } from '@/quality/checks/content-text';
import type { GateCheckResult, GateFailureReason, GateInput } from '@/quality/gate.types';
import { EARLY_WORDS } from '@/quality/wordlists/early.data';
import { MIDDLE_WORDS } from '@/quality/wordlists/middle.data';
import { SENIOR_WORDS } from '@/quality/wordlists/senior.data';

const WORDS: Readonly<Record<Band, ReadonlySet<string>>> = {
  early: new Set(EARLY_WORDS),
  middle: new Set(MIDDLE_WORDS),
  senior: new Set(SENIOR_WORDS),
};
const MAX_SENTENCE_WORDS: Readonly<Record<Band, number>> = { early: 12, middle: 20, senior: 30 };

export function checkLevel(input: GateInput): GateCheckResult {
  const reasons: Omit<GateFailureReason, 'check'>[] = [];
  const text = childFacingText(input);
  const sentences = text.split(/[.!?]+/u).filter((sentence) => sentence.trim() !== '');
  if (sentences.some((sentence) => words(sentence).length > MAX_SENTENCE_WORDS[input.band])) {
    reasons.push({ code: 'sentence_too_long', message: `Sentence is too long for ${input.band}.` });
  }
  const unknown = words(text).filter((word) => !WORDS[input.band].has(word));
  if (unknown.length > 0) {
    reasons.push({
      code: 'vocabulary',
      message: `Words exceed ${input.band} vocabulary: ${unique(unknown).join(', ')}`,
    });
  }
  return reasons.length === 0 ? passed('level') : failedMany('level', reasons);
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z]+/gu) ?? [];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
