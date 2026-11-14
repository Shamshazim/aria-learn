/**
 * P3-07: the conversion table. Only from a bigger unit to a smaller one, so every answer is a
 * whole number of the smaller unit; the factor is what a child is expected to know, not look up.
 */
export const CONVERSIONS: Readonly<Record<string, Readonly<Record<string, bigint>>>> = {
  m: { cm: 100n },
  km: { m: 1000n },
  cm: { mm: 10n },
  kg: { g: 1000n },
  L: { mL: 1000n },
  h: { min: 60n },
  min: { s: 60n },
};

export function conversionFactor(from: string, to: string): bigint | null {
  return CONVERSIONS[from]?.[to] ?? null;
}

/** Spoken and written names for the units, so "300 centimetres" and "300 cm" are one answer. */
const UNIT_WORDS =
  /\s*(?:\$|¢|c|cents?|dollars?|square|sq|units?|cm²|m²|cm|mm|m|km|kg|g|ml|l|litres?|liters?|metres?|meters?|centimetres?|centimeters?|millimetres?|grams?|kilograms?|kilometres?|hours?|h|minutes?|min|seconds?|s)\b\.?\s*/giu;

/** "300 cm", "12 square cm", "12 cm²" → "300", "12". Units are read past; the number is checked. */
export function withoutUnitWords(candidate: string): string {
  return candidate.replace(/²/gu, '').replace(UNIT_WORDS, ' ').trim();
}
