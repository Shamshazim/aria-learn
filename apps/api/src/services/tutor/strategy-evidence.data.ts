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
  // P3-07: a right digit, sign or rounded number can be reached by reading off a model,
  // picturing a number line or simply knowing, so none of them proves one strategy.
  'NUM.PV.TENS': [],
  'NUM.PV.HUNDREDS': [],
  'NUM.CMP.100': [],
  'NUM.RND.10': [],
  'ADD.FACT.10': [],
  'ADD.FACT.20': [],
  'ADD.REGROUP.2D': ['regrouped', 'lined-up-place-value'],
  // P3-07: a right column answer proves the columns were kept. Not `regrouped`: that claim
  // says "when the ones went past nine", which a tens-only trade or a subtraction is not.
  'ADD.3D': ['lined-up-place-value'],
  'SUB.FACT.10': [],
  'SUB.REGROUP.2D': ['lined-up-place-value'],
  // P3-07: a fact can be recalled or counted, so it proves nothing; a right written answer
  // proves the columns were kept, as for the addition methods.
  'MUL.FACT.10': [],
  'DIV.FACT.10': [],
  'MUL.2D1D': ['lined-up-place-value'],
  'DIV.LONG': [],
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
