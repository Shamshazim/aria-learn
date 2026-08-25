import { assertContextWithinBounds } from '@/privacy/rules/context-policy';
import { capDialogueTokens, redactFlaggedTurns } from '@/privacy/rules/dialogue-window';
import { excludeParentRestrictedFacts } from '@/privacy/rules/exclusions';
import { createIdentifierRules, type IdentifierRule } from '@/privacy/rules/identifiers';
import { redactText } from '@/privacy/rules/redact';
import type {
  ContextCategory,
  RawLearnerContext,
  ScrubbedContext,
  ScrubbedDialogueTurn,
  ScrubbedLearnerContext,
  ScrubbedLearnerMemory,
  ScrubOptions,
} from '@/privacy/types';

const contextRules: unique symbol = Symbol('scrubbed-context-rules');
type RuntimeScrubbedContext = ScrubbedContext &
  Readonly<{ [contextRules]: readonly IdentifierRule[] }>;

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

function scrubDialogue(
  raw: RawLearnerContext,
  rules: readonly IdentifierRule[],
): readonly ScrubbedDialogueTurn[] | undefined {
  const turns = redactFlaggedTurns(raw.recentDialogue ?? [])
    .map((turn) => ({ speaker: turn.speaker, text: redactText(turn.text, rules) }))
    .filter((turn) => turn.text !== '')
    .map((turn) => Object.freeze(turn));
  const capped = capDialogueTokens(turns);
  return capped.length === 0 ? undefined : Object.freeze(capped);
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
  if (value.recentDialogue !== undefined) categories.push('recent_dialogue');
  return Object.freeze(categories);
}

/** Scrubs all learner text and is the only production constructor for `ScrubbedContext`. */
export function scrubLearnerContext(
  raw: RawLearnerContext,
  options: ScrubOptions,
): ScrubbedContext {
  assertContextWithinBounds(raw);
  const rules = createIdentifierRules(raw.identifiers, {
    allowFirstName: options.pseudonym === 'include',
  });
  const skill = scrubOptional(raw.skill, rules);
  const gradeBand = scrubOptional(raw.gradeBand, rules);
  const recentEvidence = scrubList(raw.recentEvidence, rules);
  const learnerMemory = scrubMemory(raw, rules);
  const recentDialogue = scrubDialogue(raw, rules);
  const pseudonymousFirstName = scrubPseudonym(raw, options, rules);
  const value: ScrubbedLearnerContext = Object.freeze({
    ...(skill === undefined ? {} : { skill }),
    ...(gradeBand === undefined ? {} : { gradeBand }),
    ...(recentEvidence === undefined ? {} : { recentEvidence }),
    ...(learnerMemory === undefined ? {} : { learnerMemory }),
    ...(recentDialogue === undefined ? {} : { recentDialogue }),
    ...(pseudonymousFirstName === undefined ? {} : { pseudonymousFirstName }),
  });

  // The assertion is intentionally confined to this constructor; lint rejects the same cast elsewhere.
  const context = Object.freeze({
    value,
    categories: contextCategories(value),
    [contextRules]: Object.freeze([...rules]),
  }) as RuntimeScrubbedContext;
  return context;
}

/** Runtime provenance check: only this module can register a model-safe context. */
export function isScrubbedContext(value: unknown): value is ScrubbedContext {
  return isRuntimeScrubbedContext(value);
}

/** Redacts model-bound text with the identifier rules that produced its safe context. */
export function scrubTextForModel(context: ScrubbedContext, value: string): string {
  if (!isRuntimeScrubbedContext(context)) {
    throw new TypeError('Learner context was not produced by the scrubber');
  }
  return redactText(value, context[contextRules]);
}

function isRuntimeScrubbedContext(value: unknown): value is RuntimeScrubbedContext {
  return typeof value === 'object' && value !== null && contextRules in value;
}
