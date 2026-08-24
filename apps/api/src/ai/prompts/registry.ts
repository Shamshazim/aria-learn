import { classifySafetyPrompt } from '@/ai/prompts/definitions/classify-safety.prompt';
import { explainPrompt } from '@/ai/prompts/definitions/explain.prompt';
import { gradeShortAnswerPrompt } from '@/ai/prompts/definitions/grade-short-answer.prompt';
import { hintPrompt } from '@/ai/prompts/definitions/hint.prompt';
import { practiceItemPrompt } from '@/ai/prompts/definitions/practice-item.prompt';
import type { PromptRegistry } from '@/ai/prompts/types';

/**
 * Versioned prompt source of truth. Moving a prompt to FAST requires a golden-set run;
 * add definitions here instead of branching in AiClient.
 */
export const promptRegistry: PromptRegistry = {
  'classify-safety': classifySafetyPrompt,
  explain: explainPrompt,
  'grade-short-answer': gradeShortAnswerPrompt,
  hint: hintPrompt,
  'practice-item': practiceItemPrompt,
};
