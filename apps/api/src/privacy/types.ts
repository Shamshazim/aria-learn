declare const scrubbedContextBrand: unique symbol;

export type ContextCategory =
  'grade_band' | 'learner_memory' | 'pseudonymous_first_name' | 'recent_evidence' | 'skill';

export type RawIdentifiers = {
  address?: string;
  exactBirthdate?: string;
  fullName?: string;
  parentEmail?: string;
  phone?: string;
  school?: string;
};

export type RawLearnerMemory = {
  category: string;
  modelShareable: boolean;
  text: string;
};

export type RawLearnerContext = {
  gradeBand?: string;
  identifiers: RawIdentifiers;
  learnerMemory?: readonly RawLearnerMemory[];
  pseudonymousFirstName?: string;
  recentEvidence?: readonly string[];
  skill?: string;
};

export type ScrubbedLearnerMemory = Readonly<{
  category: string;
  text: string;
}>;

export type ScrubbedLearnerContext = Readonly<{
  gradeBand?: string;
  learnerMemory?: readonly ScrubbedLearnerMemory[];
  pseudonymousFirstName?: string;
  recentEvidence?: readonly string[];
  skill?: string;
}>;

/**
 * The only model-safe learner context. The private brand prevents structural construction;
 * `scrubLearnerContext` is the sole production constructor.
 */
export type ScrubbedContext = Readonly<{
  categories: readonly ContextCategory[];
  value: ScrubbedLearnerContext;
  [scrubbedContextBrand]: true;
}>;

export type ScrubOptions = {
  /** Required per call so using a pseudonym can never become an implicit default. */
  pseudonym: 'include' | 'omit';
};

export type LearnerContextDisclosure = Readonly<{
  categories: readonly ContextCategory[];
  generationLogId: string;
}>;

export type DisclosureWriter = {
  save(record: LearnerContextDisclosure): Promise<void>;
};
