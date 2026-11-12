import type { BriefEvidenceRepository } from '@/repositories/brief-evidence.repository';
import type { LearnerEpisodeRepository } from '@/repositories/learner-episode.repository';
import type { LearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import type { SkillStateRepository } from '@/repositories/skill-state.repository';

import type { PeriodWindow } from './period';
import type { BriefEvidence, SkillStanding } from './types';

/** A session's mood is about that session; it is never part of a paragraph about a child. */
const TEMPORARY_KINDS: ReadonlySet<string> = new Set([
  'mood',
  'engagement_state',
  'temporary_preference',
]);

export type EvidenceSources = Readonly<{
  facts: Pick<LearnerMemoryRepository, 'listCurrent'>;
  episodes: Pick<LearnerEpisodeRepository, 'listCurrent'>;
  skills: Pick<SkillStateRepository, 'listForStudent'>;
  sessions: BriefEvidenceRepository;
  skillName(code: string): string | null;
}>;

/**
 * Everything current a brief may say (P3-03): the facts that stand, the moments in the period,
 * the skills practised in it, and how many sessions there were.
 *
 * Only what may reach a model: a fact a parent marked private, a sensitive one or a temporary
 * one is left out, as is an episode marked not shareable. Facts are standing knowledge and are
 * used whatever their date; episodes and skills are the period's own.
 */
export async function collectEvidence(
  sources: EvidenceSources,
  studentId: string,
  window: PeriodWindow,
  now: Date,
): Promise<BriefEvidence> {
  const [facts, episodes, states, sessions] = await Promise.all([
    sources.facts.listCurrent(studentId, now),
    sources.episodes.listCurrent(studentId, now),
    sources.skills.listForStudent(studentId),
    sources.sessions.countSessions(studentId, window.start, window.end),
  ]);
  const within = (at: Date | null): boolean =>
    at !== null && at.getTime() >= window.start.getTime() && at.getTime() < window.end.getTime();
  return {
    sessions,
    facts: facts.flatMap((fact) => {
      const text = typeof fact.value.text === 'string' ? fact.value.text.trim() : '';
      const usable =
        fact.modelShareable && fact.sensitivity === 'normal' && !TEMPORARY_KINDS.has(fact.kind);
      return usable && text !== '' ? [{ id: fact.id, text }] : [];
    }),
    episodes: episodes.flatMap((episode) =>
      episode.modelShareable && within(episode.at)
        ? [{ id: episode.id, text: episode.summary }]
        : [],
    ),
    skills: states.flatMap((state) => {
      const name = sources.skillName(state.skillCode);
      return name !== null && within(state.lastSeenAt)
        ? [{ code: state.skillCode, name, standing: standing(state.strength) }]
        : [];
    }),
  };
}

export function isEmpty(evidence: BriefEvidence): boolean {
  return (
    evidence.sessions === 0 &&
    evidence.facts.length === 0 &&
    evidence.episodes.length === 0 &&
    evidence.skills.length === 0
  );
}

function standing(strength: number): SkillStanding {
  if (strength < 0.3) return 'new';
  return strength < 0.8 ? 'practising' : 'strong';
}
