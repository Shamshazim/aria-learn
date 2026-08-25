/**
 * Curriculum words a text-to-speech engine reads wrongly, and how to spell them so it does not.
 *
 * These are respellings, not phonemes: every engine reads ordinary letters, and not every
 * engine reads IPA or the same phoneme alphabet. Each entry earned its place by being heard
 * wrong in the listening review recorded in `dev-docs/voice-review.md`.
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
