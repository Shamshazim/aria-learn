export type Proportion = Readonly<{
  passed: number;
  total: number;
  rate: number;
  confidence95: Readonly<{ lower: number; upper: number }>;
}>;

export function proportion(passed: number, total: number): Proportion {
  if (
    !Number.isInteger(passed) ||
    !Number.isInteger(total) ||
    total <= 0 ||
    passed < 0 ||
    passed > total
  ) {
    throw new Error('Golden-set counts must be positive integers with passed <= total');
  }
  const rate = passed / total;
  const z = 1.96;
  const denominator = 1 + (z * z) / total;
  const centre = rate + (z * z) / (2 * total);
  const spread = z * Math.sqrt((rate * (1 - rate) + (z * z) / (4 * total)) / total);
  return {
    passed,
    total,
    rate,
    confidence95: {
      lower: Math.max(0, (centre - spread) / denominator),
      upper: Math.min(1, (centre + spread) / denominator),
    },
  };
}
