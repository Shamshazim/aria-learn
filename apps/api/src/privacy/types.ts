declare const scrubbedContextBrand: unique symbol;

export type ContextCategory =
  | 'grade_band'
  | 'learner_memory'
  | 'pseudonymous_first_name'
  | 'recent_dialogue'
  | 'recent_evidence'
  | 'skill';

export type DialogueSpeaker = 'aria' | 'child';

export type RawDialogueTurn = {
  speaker: DialogueSpeaker;
  text: string;
  /** The safety layer flagged this turn. Its text never crosses the vendor boundary (P2H-04). */
  safetyFlagged?: boolean;
};
export type ScrubbedDialogueTurn = Readonly<{ speaker: DialogueSpeaker; text: string }>;

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
  /** The last few turns of this session, oldest first (P2H-04). */
  recentDialogue?: readonly RawDialogueTurn[];
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
  recentDialogue?: readonly ScrubbedDialogueTurn[];
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
  /**
   * Required per call so using a pseudonym can never become an implicit default.
   * `include` also exempts the child's first-name token from redaction (P2H-04 decision:
   * the first name alone may cross the vendor boundary; nothing else about identity does).
   */
  pseudonym: 'include' | 'omit';
};

export type LearnerContextDisclosure = Readonly<{
  categories: readonly ContextCategory[];
  generationLogId: string;
}>;

export type DisclosureWriter = {
  save(record: LearnerContextDisclosure): Promise<void>;
};
