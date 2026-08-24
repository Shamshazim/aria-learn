/** Public privacy seam: scrub first, then disclose only the categories shared. */
export { createDisclosureService } from '@/privacy/disclosure/disclosure.service';
export { scrubLearnerContext } from '@/privacy/scrub';

export type { DisclosureService } from '@/privacy/disclosure/disclosure.service';
export type {
  ContextCategory,
  DisclosureWriter,
  LearnerContextDisclosure,
  RawIdentifiers,
  RawLearnerContext,
  RawLearnerMemory,
  ScrubbedContext,
  ScrubbedLearnerContext,
  ScrubOptions,
} from '@/privacy/types';
