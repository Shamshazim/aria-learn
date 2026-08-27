import type {
  RawLearnerContext,
  ScrubbedContext,
  ScrubbedDialogueTurn,
  ScrubbedLearnerContext,
} from '@/privacy/types';

type AiClientBoundary = {
  run(context: ScrubbedContext): void;
};

function verifyRawContextCannotCrossBoundary(
  aiClient: AiClientBoundary,
  raw: RawLearnerContext,
): void {
  // @ts-expect-error Raw learner context must pass through scrubLearnerContext first.
  aiClient.run(raw);
}

/**
 * P2H-04: `recentDialogue` and `pseudonymousFirstName` are set by the scrubber and nobody else.
 *
 * The brand makes a hand-built object unusable as a `ScrubbedContext`, which is what stops a
 * caller assembling a context with a child's real name and a raw transcript and handing it to
 * a model. These are compile-time assertions; `scrub.test.ts` covers the runtime guard.
 */
function verifyContextCannotBeHandBuilt(
  aiClient: AiClientBoundary,
  value: ScrubbedLearnerContext,
  dialogue: readonly ScrubbedDialogueTurn[],
): void {
  // @ts-expect-error Only scrubLearnerContext can produce a branded, disclosable context.
  aiClient.run({ value, categories: ['recent_dialogue', 'pseudonymous_first_name'] });
  // @ts-expect-error The same holds when the caller supplies the dialogue window directly.
  aiClient.run({ value: { ...value, recentDialogue: dialogue }, categories: ['recent_dialogue'] });
  // @ts-expect-error And when the caller supplies a first name directly.
  aiClient.run({ value: { ...value, pseudonymousFirstName: 'Priya' }, categories: [] });
}

void verifyRawContextCannotCrossBoundary;
void verifyContextCannotBeHandBuilt;
