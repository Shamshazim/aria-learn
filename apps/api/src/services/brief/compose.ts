import type { BriefEvidenceSnapshot, BriefPeriod } from '@aria/shared';

import { BRIEF_CHILD_TOKEN } from '@/ai/prompts/definitions/learner-brief.prompt';

import { describeNotJudge } from './lint/describe-not-judge';
import { readability } from './lint/readability';

import type { EvidenceRefs } from './brief.prompt.input';
import type { BriefEvidence } from './types';

export type BriefSentence = Readonly<{ text: string; refs: readonly string[] }>;

/**
 * The sentences a brief may keep (P3-03): each one names at least one piece of evidence that
 * was actually offered. A sentence citing nothing, or citing a reference the model made up, is
 * dropped — which is what makes "every sentence is traceable to the snapshot" true by
 * construction rather than by hope.
 */
export function traceable(
  sentences: readonly BriefSentence[],
  refs: EvidenceRefs,
): readonly BriefSentence[] {
  return sentences
    .map((sentence) => ({ text: sentence.text.trim(), refs: [...new Set(sentence.refs)] }))
    .filter(
      (sentence) =>
        sentence.text !== '' &&
        sentence.refs.length > 0 &&
        sentence.refs.every((ref) => refs.has(ref)),
    );
}

export function bodyOf(sentences: readonly BriefSentence[]): string {
  return sentences.map((sentence) => sentence.text).join(' ');
}

/** What a body breaks: the describe-never-judge lint and the period's word cap. */
export function lintBody(body: string, wordCap: number): readonly string[] {
  return [...describeNotJudge(body), ...readability(body, wordCap)];
}

/** The ids the kept sentences rest on, by kind. */
export function snapshotOf(
  sentences: readonly BriefSentence[],
  refs: EvidenceRefs,
): BriefEvidenceSnapshot {
  const ids = (kind: 'fact' | 'episode' | 'skill'): string[] => [
    ...new Set(
      sentences.flatMap((sentence) =>
        sentence.refs.flatMap((ref) => {
          const target = refs.get(ref);
          return target?.kind === kind ? [target.id] : [];
        }),
      ),
    ),
  ];
  return { factIds: ids('fact'), episodeIds: ids('episode'), skillCodes: ids('skill') };
}

/**
 * The brief with no model (P3-03): the evidence, said plainly. Used when the model is down,
 * and when its paragraph failed the lint twice. Each sentence still cites its evidence, any
 * sentence that would break the lint is left out, and it stops at the word cap.
 */
export function templateSentences(
  evidence: BriefEvidence,
  period: BriefPeriod,
  refs: EvidenceRefs,
  wordCap: number,
): readonly BriefSentence[] {
  const byId = new Map([...refs].map(([ref, target]) => [`${target.kind}:${target.id}`, ref]));
  const ref = (kind: 'fact' | 'episode' | 'skill', id: string): string[] => {
    const found = byId.get(`${kind}:${id}`);
    return found === undefined ? [] : [found];
  };
  const candidates: BriefSentence[] = [
    ...evidence.skills.map((skill) => ({
      text: `${BRIEF_CHILD_TOKEN} ${SKILL_VERBS[skill.standing]} ${skill.name}.`,
      refs: ref('skill', skill.code),
    })),
    ...evidence.episodes.map((episode) => ({
      text: episode.text,
      refs: ref('episode', episode.id),
    })),
    ...evidence.facts.map((fact) => ({ text: fact.text, refs: ref('fact', fact.id) })),
  ].filter((sentence) => sentence.refs.length > 0 && describeNotJudge(sentence.text).length === 0);
  const sessions = `${BRIEF_CHILD_TOKEN} had ${String(evidence.sessions)} ${evidence.sessions === 1 ? 'session' : 'sessions'} with Aria this ${period}.`;
  const kept: BriefSentence[] = [];
  let words = sessions.split(/\s+/u).length;
  for (const sentence of candidates) {
    const length = sentence.text.split(/\s+/u).length;
    if (words + length > wordCap) break;
    kept.push(sentence);
    words += length;
  }
  return [{ text: sessions, refs: [] }, ...kept];
}

const SKILL_VERBS = {
  new: 'started on',
  practising: 'practised',
  strong: 'worked through',
} as const;
