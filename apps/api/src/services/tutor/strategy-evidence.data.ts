/**
 * What a correct answer on a skill proves the child did (P2H-11).
 *
 * The bar is deliberately high: a strategy is listed only where the item cannot be answered
 * correctly without it. `ADD.FACT.10` is empty on purpose — a child who says "seven" may have
 * counted on, made a ten, or simply remembered, and praising the wrong one tells them we were
 * not watching.
 *
 * Keys are skill codes; values are ids from `STRATEGY_CLAIMS`.
 */
export const SKILL_STRATEGIES: Readonly<Record<string, readonly string[]>> = {
  'NUM.CNT.20': ['counted-on'],
  'NUM.CNT.SKIP5': ['skip-counted'],
  'ADD.FACT.10': [],
  'ADD.REGROUP.2D': ['regrouped', 'lined-up-place-value'],
  'FRAC.EQUAL': ['same-size-pieces'],
  'FRAC.COMPARE': ['same-size-pieces'],
  'PA.RHYME': [],
  'PA.BLEND': ['blended-the-sounds'],
  'PH.CVC': ['sounded-it-out'],
  'PH.SILENT_E': ['sounded-it-out'],
  'FL.WCPM.60': [],
  'CMP.RETELL': [],
  'WR.WORD': [],
  'WR.SENTENCE': [],
  'WR.PARAGRAPH': [],
  'WR.SHORT_PIECE': [],
};
