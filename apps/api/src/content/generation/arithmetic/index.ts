/** Deterministic arithmetic item generation, proven by the P0-16 checker (P2H-10). */
export { buildDistractors } from '@/content/generation/arithmetic/distractors';
export type { Distractor } from '@/content/generation/arithmetic/distractors';
export { generateItem, parameterSpaceSize } from '@/content/generation/arithmetic/generate-item';
export type { GenerateInput } from '@/content/generation/arithmetic/generate-item';
export { phraseItem } from '@/content/generation/arithmetic/phrasing';
export { acceptWordProblem } from '@/content/generation/arithmetic/word-problem';
export type { WordProblemVerdict } from '@/content/generation/arithmetic/word-problem';
export { ARITHMETIC_SKILL_CODES } from '@/content/generation/arithmetic/params';
export type { CandidateItem, GeneratedItem } from '@/content/generation/arithmetic/types';
