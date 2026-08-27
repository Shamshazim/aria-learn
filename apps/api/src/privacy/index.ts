/** Public privacy seam: scrub first, then disclose only the categories shared. */
export { PARENT_DISCLOSURE, parentDisclosureFor } from '@/privacy/disclosure/categories';
export { createDisclosureService } from '@/privacy/disclosure/disclosure.service';
export {
  DIALOGUE_TOKEN_CAP,
  SAFETY_REDACTION,
  estimateDialogueTokens,
} from '@/privacy/rules/dialogue-window';
export { isScrubbedContext, scrubLearnerContext, scrubTextForModel } from '@/privacy/scrub';

export type { ParentDisclosureEntry } from '@/privacy/disclosure/categories';
export type { DisclosureService } from '@/privacy/disclosure/disclosure.service';
export type {
  ContextCategory,
  DisclosureWriter,
  LearnerContextDisclosure,
  RawDialogueTurn,
  RawIdentifiers,
  RawLearnerContext,
  RawLearnerMemory,
  ScrubbedContext,
  ScrubbedLearnerContext,
  ScrubOptions,
} from '@/privacy/types';
