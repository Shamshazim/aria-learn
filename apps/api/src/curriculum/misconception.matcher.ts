import {
  AUTHORED_MISCONCEPTIONS,
  matchesSignature,
  type MisconceptionInput,
} from '@/curriculum/misconceptions';

/**
 * Which recorded wrong ideas this answer carries (P2H-10).
 *
 * Plural on purpose. Two signatures can both fire — a two-digit sum that is also one short of
 * the key, say — and picking one arbitrarily would send the child to a reteach for a
 * misconception they may not hold. Every candidate is returned; the caller resolves it with
 * what it knows about this child.
 */
export function matchMisconceptions(input: MisconceptionInput): readonly string[] {
  return AUTHORED_MISCONCEPTIONS.filter(
    (misconception) =>
      misconception.skillCode === input.skillCode && matchesSignature(misconception.detects, input),
  ).map((misconception) => misconception.id);
}

/**
 * The one to reteach, given what this child has shown before.
 *
 * A misconception the child has already demonstrated outranks a first sighting: seeing the
 * same wrong idea twice is far stronger evidence than a signature that happens to fit once.
 * With nothing to go on, authored order wins, which is the order a teacher wrote them in.
 */
export function matchMisconception(
  input: MisconceptionInput,
  priors: readonly string[] = [],
): string | null {
  const candidates = matchMisconceptions(input);
  return candidates.find((id) => priors.includes(id)) ?? candidates[0] ?? null;
}
