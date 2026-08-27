import type { Band } from '@aria/shared';

/** Six or more reviewed ways to say one thing, per band (P2H-11). */
export type BandVariants = Readonly<Record<Band, readonly string[]>>;

/**
 * What a variant can be filled with.
 *
 * A variant naming a parameter is only eligible when that parameter is known this turn, so
 * "Yes, {answer} is right" never reaches a child as "Yes, is right".
 */
export type FallbackParameters = Readonly<{
  name?: string;
  skillName?: string;
  answer?: string;
}>;
