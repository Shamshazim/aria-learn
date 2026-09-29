/**
 * Folds text to the form the deterministic rules match against (X-05).
 *
 * The rules in `rules.ts` are the part of the system that must never depend on a model: a
 * child offering their address is deflected by a pattern, not by asking a vendor whether that
 * was an address. Which means the patterns are worth attacking, and the cheapest attack is not
 * a clever sentence — it is `my аddress is…` with a Cyrillic а, which reads identically to a
 * person and matches nothing.
 *
 * So the text is folded first: compatibility-normalised, stripped of characters that render as
 * nothing, mapped out of the alphabets that imitate Latin, and stripped of accents. What comes
 * out is only ever used for *matching*; the child's own words are what get stored, spoken
 * about and — where the rules say so — redacted.
 */

/**
 * Characters that occupy no width and so can be sprinkled through a word invisibly:
 * zero-width space/non-joiner/joiner, the bidi controls, word joiner, soft hyphen and BOM.
 */
const INVISIBLE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/gu;

/** Every space-like character, folded to one plain space so `\s` boundaries hold. */
const SEPARATORS = /[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/gu;

/** Combining marks, left behind by decomposition: `é` becomes `e` plus one of these. */
const COMBINING = /\p{M}+/gu;

/**
 * Latin look-alikes from the alphabets a keyboard can actually produce.
 *
 * Not the full Unicode confusables table, which is thousands of entries and would need a data
 * file and a licence. These are the Cyrillic and Greek letters that render as Latin ones in
 * every common font, plus the punctuation a phone's autocorrect substitutes — which together
 * cover what a copy-pasted or auto-corrected sentence actually contains.
 */
const CONFUSABLES: Readonly<Record<string, string>> = {
  а: 'a',
  в: 'b',
  с: 'c',
  ԁ: 'd',
  е: 'e',
  ѕ: 's',
  һ: 'h',
  і: 'i',
  ј: 'j',
  к: 'k',
  ӏ: 'l',
  м: 'm',
  н: 'h',
  о: 'o',
  р: 'p',
  ԛ: 'q',
  г: 'r',
  т: 't',
  у: 'y',
  х: 'x',
  ѵ: 'v',
  ω: 'w',
  α: 'a',
  β: 'b',
  ε: 'e',
  ѐ: 'e',
  ι: 'i',
  κ: 'k',
  ν: 'v',
  ο: 'o',
  ρ: 'p',
  σ: 'o',
  τ: 't',
  υ: 'u',
  χ: 'x',
  γ: 'y',
  ζ: 'z',
  η: 'n',
  µ: 'u',
  '’': "'",
  '‘': "'",
  '‛': "'",
  '＇': "'",
  '“': '"',
  '”': '"',
  '–': '-',
  '—': '-',
  '‐': '-',
  '‑': '-',
  '．': '.',
  '。': '.',
  '，': ',',
  '：': ':',
  '＠': '@',
};

const CONFUSABLE_PATTERN = new RegExp(`[${Object.keys(CONFUSABLES).join('')}]`, 'gu');

export function foldForMatching(text: string): string {
  // NFKC first: it turns full-width `ａｄｄｒｅｓｓ`, the ﬁ ligature and superscripts into their
  // plain forms, so the maps below only have to cover what compatibility folding leaves.
  const compatible = text.normalize('NFKC').replace(INVISIBLE, '');
  const latin = compatible
    .toLowerCase()
    .replace(CONFUSABLE_PATTERN, (character) => CONFUSABLES[character] ?? character);
  // Decompose, drop the accents, recompose: `addréss` and `ADDRESS` reach the rules the same.
  return latin.normalize('NFD').replace(COMBINING, '').normalize('NFC').replace(SEPARATORS, ' ');
}
