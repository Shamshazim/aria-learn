import type { Band } from '@aria/shared';

import { sentencesOf } from '@/quality/checks/level/readability';

/**
 * Two register rules that are not readability (P2H-03).
 *
 * Readability asks whether a child can decode the sentence. Register asks whether a tutor
 * would have said it that way. A fourteen-year-old being cheered at with exclamation marks
 * hears condescension, not warmth; a five-year-old given a paragraph stops listening at the
 * second sentence. Both are trivially checkable, so neither is left to the model to remember.
 */
export type RegisterFailure = Readonly<{ code: string; message: string }>;

const MAX_EARLY_SENTENCES = 2;

export function registerFailures(text: string, band: Band): readonly RegisterFailure[] {
  if (band === 'senior' && text.includes('!')) {
    return [
      {
        code: 'senior_exclamation',
        message: 'Senior-band text is calm and adult: no exclamation marks.',
      },
    ];
  }
  if (band === 'early' && sentencesOf(text).length > MAX_EARLY_SENTENCES) {
    return [
      {
        code: 'early_too_many_sentences',
        message: `Early-band text is at most ${String(MAX_EARLY_SENTENCES)} sentences.`,
      },
    ];
  }
  return [];
}
