import type { MisconceptionInput, TextRule } from '@/curriculum/misconceptions/signature.types';

/**
 * The reading and writing rules, computed from the key or the question (P2H-10).
 *
 * These are shape checks on what the child produced, not judgements about whether they
 * understood. That is deliberate: a deterministic matcher can prove that a retell echoed the
 * question back, and cannot prove that a retell was thin. The ones it cannot prove are left to
 * a teacher rather than guessed at here.
 */
export function predictTextError(rule: TextRule, input: MisconceptionInput): readonly string[] {
  const key = normalise(input.expectedAnswer ?? '');
  switch (rule) {
    case 'echoes-the-question':
      return echoes(input.question);
    case 'drops-middle-letter':
      return key.length < 3 ? [] : [key.slice(0, middle(key)) + key.slice(middle(key) + 1)];
    case 'swapped-vowel':
      return swappedVowels(key);
    case 'shorter-than-key':
      return shorter(key);
    default:
      return [];
  }
}

function echoes(question: string | null): readonly string[] {
  const text = normalise(question ?? '').replace(/[?.!]+$/u, '');
  return text === '' ? [] : [text];
}

function middle(key: string): number {
  return Math.floor((key.length - 1) / 2);
}

const VOWELS: readonly string[] = ['a', 'e', 'i', 'o', 'u'];

/** Every same-length word the key becomes when its one vowel is read as another. */
function swappedVowels(key: string): readonly string[] {
  const index = /[aeiou]/u.exec(key)?.index;
  if (index === undefined) return [];
  return VOWELS.filter((vowel) => vowel !== key[index]).map(
    (vowel) => key.slice(0, index) + vowel + key.slice(index + 1),
  );
}

/** The key with its last word missing: what a skipped word leaves behind. */
function shorter(key: string): readonly string[] {
  const words = key.split(' ').filter((word) => word !== '');
  return words.length < 2 ? [] : [words.slice(0, -1).join(' ')];
}

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase().replaceAll(/\s+/gu, ' ');
}
