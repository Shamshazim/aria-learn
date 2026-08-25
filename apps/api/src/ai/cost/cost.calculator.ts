export type TokenPrices = Readonly<{ inputPerMillion: number; outputPerMillion: number }>;

/** Computes one provider charge from integer token counts and configured per-million prices. */
export function calculateCostUsd(tokensIn: number, tokensOut: number, prices: TokenPrices): number {
  return (tokensIn * prices.inputPerMillion + tokensOut * prices.outputPerMillion) / 1_000_000;
}
