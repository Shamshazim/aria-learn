/**
 * Curriculum words a text-to-speech engine reads wrongly, and how to spell them so it does not.
 *
 * These are respellings, not phonemes: every engine reads ordinary letters, and not every
 * engine reads IPA or the same phoneme alphabet.
 *
 * Every entry here is a **guess**, seeded from the terms most likely to appear in the initial
 * scope. The listening review that would confirm them has not been run — `dev-docs/voice-review.md`
 * §4 is empty — and a run that finds an entry unnecessary should delete it.
 *
 * Keys are matched whole-word and case-insensitively; the replacement keeps no capitals,
 * because it is never displayed.
 */
export const CURRICULUM_LEXICON: Readonly<Record<string, string>> = {
  numerator: 'NEW-mer-ay-tor',
  denominator: 'dee-NOM-in-ay-tor',
  digraph: 'DYE-graf',
  grapheme: 'GRAF-eem',
  phoneme: 'FOH-neem',
  segmenting: 'SEG-ment-ing',
  quotient: 'KWOH-shunt',
  isosceles: 'eye-SOSS-uh-leez',
  perimeter: 'puh-RIM-uh-tur',
  regrouping: 'ree-GROOP-ing',
};
