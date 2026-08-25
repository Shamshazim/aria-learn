import { markProsody } from './prosody/markers';
import { speakQuantities } from './spoken-form/quantities';
import { speakPlaceValue, speakSymbols } from './spoken-form/symbols';

export type SpokenContext = 'default' | 'phoneme' | 'place-value';

/**
 * The written sentence, turned into the sentence Aria says.
 *
 * Three things happen here and nowhere else: the author's prosody marks become vendor-neutral
 * tokens, the characters a child would never say become words, and the numbers are read the
 * way a person reads them. The result still has no vendor in it — the worker's adapter is what
 * turns a token into markup or drops it (`prosody/markers.ts`).
 *
 * `place-value` reads digits one at a time because that is the lesson; it is the only context
 * where "12" is not "twelve".
 */
export function spokenForm(written: string, context: SpokenContext = 'default'): string {
  const marked = speakSymbols(markProsody(written));
  const spoken = context === 'place-value' ? speakPlaceValue(marked) : speakQuantities(marked);
  return spoken.replace(/[^\S\n]{2,}/gu, ' ').trim();
}
