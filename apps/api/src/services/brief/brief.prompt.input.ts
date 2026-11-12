import type { BriefPeriod } from '@aria/shared';

import type { LearnerBriefPromptInput } from '@/ai/prompts/types';
import type { ScrubbedContext } from '@/privacy';

import type { BriefEvidence } from './types';

const MAX_ITEMS = 32;

/** What each reference in the prompt stands for, so a sentence can be traced back to rows. */
export type EvidenceRefs = ReadonlyMap<
  string,
  Readonly<{ kind: 'fact' | 'episode' | 'skill'; id: string }>
>;

/**
 * The model's input for a brief (P3-03): the evidence, each item under a short reference, and
 * nothing else about the past. There is no parameter here for a previous brief — the rule is
 * "regenerated from current evidence, not recursively summarised" — and the prompt input type
 * has no field one could go into.
 */
export function buildBriefPromptInput(
  input: Readonly<{
    context: ScrubbedContext;
    period: BriefPeriod;
    wordCap: number;
    evidence: BriefEvidence;
    avoid: readonly string[];
  }>,
): Readonly<{ prompt: LearnerBriefPromptInput; refs: EvidenceRefs }> {
  const refs = new Map<string, { kind: 'fact' | 'episode' | 'skill'; id: string }>();
  const facts = input.evidence.facts.slice(0, MAX_ITEMS).map((fact, index) => {
    const ref = `F${String(index + 1)}`;
    refs.set(ref, { kind: 'fact', id: fact.id });
    return { ref, text: fact.text };
  });
  const episodes = input.evidence.episodes.slice(0, MAX_ITEMS).map((episode, index) => {
    const ref = `E${String(index + 1)}`;
    refs.set(ref, { kind: 'episode', id: episode.id });
    return { ref, text: episode.text };
  });
  const skills = input.evidence.skills.slice(0, MAX_ITEMS).map((skill, index) => {
    const ref = `S${String(index + 1)}`;
    refs.set(ref, { kind: 'skill', id: skill.code });
    return { ref, name: skill.name, standing: skill.standing };
  });
  return {
    prompt: {
      context: input.context,
      period: input.period,
      wordCap: input.wordCap,
      sessions: input.evidence.sessions,
      facts,
      episodes,
      skills,
      avoid: input.avoid.slice(0, 16),
    },
    refs,
  };
}
