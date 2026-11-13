import { lowest } from '@/quality/arithmetic/fraction-format';
import type { Rational } from '@/quality/arithmetic/types';

/**
 * A rational as a decimal, when it has one that ends (P3-07): 93/20 is "4.65", 1/2 is "0.5",
 * 3 is "3". Trailing zeros are dropped, so "4.60" and "4.6" are written alike. `null` for one
 * that never ends, such as a third; the caller writes those as fractions.
 */
export function formatDecimal(value: Rational): string | null {
  const { numerator, denominator } = lowest(value);
  if (!terminates(denominator)) return null;
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  let places = 0;
  let scale = 1n;
  while ((magnitude * scale) % denominator !== 0n) {
    scale *= 10n;
    places += 1;
  }
  const digits = ((magnitude * scale) / denominator).toString().padStart(places + 1, '0');
  const whole = digits.slice(0, digits.length - places);
  const part = digits.slice(digits.length - places);
  return `${negative ? '-' : ''}${whole}${places === 0 ? '' : `.${part}`}`;
}

/** Ends as a decimal exactly when the denominator has no prime factor but 2 and 5. */
function terminates(denominator: bigint): boolean {
  let rest = denominator;
  for (const prime of [2n, 5n]) while (rest % prime === 0n) rest /= prime;
  return rest === 1n;
}

/** How many digits a written decimal has after its point: "0.25" has two, "3" has none. */
export function decimalPlaces(text: string): number {
  const point = text.trim().indexOf('.');
  return point === -1 ? 0 : text.trim().length - point - 1;
}
