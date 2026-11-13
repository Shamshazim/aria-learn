/** One step of a written method: what to work out, and what it comes to (P3-07). */
export type ProcedureStep = Readonly<{ prompt: string; answer: string }>;

/**
 * Column addition on whole numbers, naming the columns from the right. Decimals use it too,
 * counted in hundredths with the columns named hundredths, tenths, ones (P3-07).
 */
export function columnAdditionSteps(
  left: bigint,
  right: bigint,
  places: readonly string[],
): readonly ProcedureStep[] {
  const steps: ProcedureStep[] = [];
  let carry = 0n;
  for (let place = 0, top = left, bottom = right; top > 0n || bottom > 0n; place += 1) {
    const sum = (top % 10n) + (bottom % 10n) + carry;
    const carried = carry > 0n ? ` and the carried ${carry.toString()}` : '';
    steps.push({
      prompt: `Add the ${places[place] ?? 'next'} column: ${(top % 10n).toString()} and ${(bottom % 10n).toString()}${carried}.`,
      answer: sum.toString(),
    });
    carry = sum / 10n;
    top /= 10n;
    bottom /= 10n;
  }
  return steps;
}
