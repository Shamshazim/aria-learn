import type { RawLearnerContext, ScrubbedContext } from '@/privacy/types';

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

void verifyRawContextCannotCrossBoundary;
