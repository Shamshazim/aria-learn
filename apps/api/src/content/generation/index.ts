/** Code-first content generation (P2H-10). */
export {
  isArithmeticLookup,
  nextItemFor,
  toGeneratedContent,
} from '@/content/generation/arithmetic-draft';
export {
  acceptWordProblem,
  ARITHMETIC_SKILL_CODES,
  buildDistractors,
  generateItem,
  parameterSpaceSize,
  phraseItem,
} from '@/content/generation/arithmetic';
export type {
  Distractor,
  GeneratedItem,
  GenerateInput,
  WordProblemVerdict,
} from '@/content/generation/arithmetic';
