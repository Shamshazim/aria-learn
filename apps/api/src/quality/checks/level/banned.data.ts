/**
 * Words Aria never says to a child regardless of readability (P2H-02). Matched as whole words,
 * case-insensitive. Safety classification is a separate check; this is tone, not danger.
 */
export const BANNED_WORDS: readonly string[] = [
  'stupid',
  'dumb',
  'idiot',
  'moron',
  'loser',
  'shut up',
  'hate you',
  'kill',
  'die',
  'damn',
  'hell',
  'crap',
  'sucks',
  'pathetic',
  'worthless',
];
