import type { RawLearnerContext } from '@/privacy/types';

// Resource-safety ceilings mirror the protocol's existing 2,000-char/128-id/32-item bounds.
// Relevance selection and token budgeting remain P1-10's responsibility.
const MAX_CONTEXT_ITEMS = 32;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_CONTEXT_TEXT_LENGTH = 2000;
const MAX_MEMORY_CATEGORY_LENGTH = 64;

function assertIdentifierBounds(raw: RawLearnerContext): void {
  const identifiers = Object.values(raw.identifiers);
  if (identifiers.some((value) => value.length > MAX_IDENTIFIER_LENGTH)) {
    throw new RangeError('Learner identifier exceeds the privacy limit.');
  }
}

function assertCollectionBounds(raw: RawLearnerContext): void {
  if ((raw.recentEvidence?.length ?? 0) > MAX_CONTEXT_ITEMS) {
    throw new RangeError('Recent evidence exceeds the privacy limit.');
  }
  if ((raw.learnerMemory?.length ?? 0) > MAX_CONTEXT_ITEMS) {
    throw new RangeError('Learner memory exceeds the privacy limit.');
  }
}

function assertMemoryCategoryBounds(raw: RawLearnerContext): void {
  if (
    raw.learnerMemory?.some((fact) => fact.category.length > MAX_MEMORY_CATEGORY_LENGTH) === true
  ) {
    throw new RangeError('Learner memory category exceeds the privacy limit.');
  }
}

function assertContextTextBounds(raw: RawLearnerContext): void {
  const contextText = [
    raw.skill,
    raw.gradeBand,
    raw.pseudonymousFirstName,
    ...(raw.recentEvidence ?? []),
    ...(raw.learnerMemory ?? []).map((fact) => fact.text),
  ];
  if (contextText.some((value) => value !== undefined && value.length > MAX_CONTEXT_TEXT_LENGTH)) {
    throw new RangeError('Learner context text exceeds the privacy limit.');
  }
}

export function assertContextWithinBounds(raw: RawLearnerContext): void {
  assertIdentifierBounds(raw);
  assertCollectionBounds(raw);
  assertMemoryCategoryBounds(raw);
  assertContextTextBounds(raw);
}
