import type { RelevantFact } from '@/services/memory/relevance/rules';

export type BudgetedFacts = Readonly<{ facts: readonly RelevantFact[]; estimatedTokens: number }>;

export function applyTokenBudget(
  ranked: readonly RelevantFact[],
  maxTokens: number,
): BudgetedFacts {
  const selected: RelevantFact[] = [];
  let estimatedTokens = 0;
  for (const item of ranked) {
    const itemTokens = estimateTokens(item.text);
    if (estimatedTokens + itemTokens > maxTokens) continue;
    selected.push(item);
    estimatedTokens += itemTokens;
  }
  return { facts: selected, estimatedTokens };
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
