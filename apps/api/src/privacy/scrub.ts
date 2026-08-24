import { assertContextWithinBounds } from '@/privacy/rules/context-policy';
import { excludeParentRestrictedFacts } from '@/privacy/rules/exclusions';
import { createIdentifierRules, type IdentifierRule } from '@/privacy/rules/identifiers';
import { redactText } from '@/privacy/rules/redact';
import type {
  ContextCategory,
  RawLearnerContext,
  ScrubbedContext,
  ScrubbedLearnerContext,
  ScrubbedLearnerMemory,
  ScrubOptions,
} from '@/privacy/types';

function scrubOptional(
  value: string | undefined,
  rules: readonly IdentifierRule[],
): string | undefined {
  if (value === undefined) return undefined;
  const redacted = redactText(value, rules);
  return redacted === '' ? undefined : redacted;
}

function scrubList(
  values: readonly string[] | undefined,
  rules: readonly IdentifierRule[],
): readonly string[] | undefined {
  if (values === undefined) return undefined;
  const redacted = values.map((value) => redactText(value, rules)).filter((value) => value !== '');
  return redacted.length === 0 ? undefined : Object.freeze(redacted);
}

function scrubMemory(
  raw: RawLearnerContext,
  rules: readonly IdentifierRule[],
): readonly ScrubbedLearnerMemory[] | undefined {
  const shareable = excludeParentRestrictedFacts(raw.learnerMemory ?? []);
  const memory = shareable
    .map((fact) => ({
      category: redactText(fact.category, rules),
      text: redactText(fact.text, rules),
    }))
    .filter((fact) => fact.category !== '' && fact.text !== '')
    .map((fact) => Object.freeze(fact));
  return memory.length === 0 ? undefined : Object.freeze(memory);
}

function scrubPseudonym(
  raw: RawLearnerContext,
  options: ScrubOptions,
  rules: readonly IdentifierRule[],
): string | undefined {
  if (options.pseudonym === 'omit') return undefined;
  const pseudonym = scrubOptional(raw.pseudonymousFirstName, rules);
  return pseudonym?.includes('[redacted:') === true ? undefined : pseudonym;
}

function contextCategories(value: ScrubbedLearnerContext): readonly ContextCategory[] {
  const categories: ContextCategory[] = [];
  if (value.skill !== undefined) categories.push('skill');
  if (value.gradeBand !== undefined) categories.push('grade_band');
  if (value.recentEvidence !== undefined) categories.push('recent_evidence');
  if (value.learnerMemory !== undefined) categories.push('learner_memory');
  if (value.pseudonymousFirstName !== undefined) categories.push('pseudonymous_first_name');
  return Object.freeze(categories);
}

/** Scrubs all learner text and is the only production constructor for `ScrubbedContext`. */
export function scrubLearnerContext(
  raw: RawLearnerContext,
  options: ScrubOptions,
): ScrubbedContext {
  assertContextWithinBounds(raw);
  const rules = createIdentifierRules(raw.identifiers);
  const skill = scrubOptional(raw.skill, rules);
  const gradeBand = scrubOptional(raw.gradeBand, rules);
  const recentEvidence = scrubList(raw.recentEvidence, rules);
  const learnerMemory = scrubMemory(raw, rules);
  const pseudonymousFirstName = scrubPseudonym(raw, options, rules);
  const value: ScrubbedLearnerContext = Object.freeze({
    ...(skill === undefined ? {} : { skill }),
    ...(gradeBand === undefined ? {} : { gradeBand }),
    ...(recentEvidence === undefined ? {} : { recentEvidence }),
    ...(learnerMemory === undefined ? {} : { learnerMemory }),
    ...(pseudonymousFirstName === undefined ? {} : { pseudonymousFirstName }),
  });

  // The assertion is intentionally confined to this constructor; lint rejects the same cast elsewhere.
  return Object.freeze({ value, categories: contextCategories(value) }) as ScrubbedContext;
}
