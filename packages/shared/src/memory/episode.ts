/**
 * Learner episodes (P3-01): the moments worth remembering — "place value clicked after three
 * weeks" — that `master-plan.md` §4.2 puts between raw events and the learner brief.
 *
 * `Time` is the timestamp representation: `Date` inside the API, an ISO string once the record
 * has crossed the wire. The fields have one definition either way.
 */

export const EPISODE_KINDS = [
  'breakthrough',
  'struggle',
  'preference_change',
  'return_after_absence',
  'goal_reached',
  'other',
] as const;
export type EpisodeKind = (typeof EPISODE_KINDS)[number];

/** Where an episode's evidence comes from. Never a model's say-so alone. */
export const EPISODE_EVIDENCE_SOURCES = ['session_event', 'oral_reading', 'child_writing'] as const;
export type EpisodeEvidenceSource = (typeof EPISODE_EVIDENCE_SOURCES)[number];

export type EpisodeEvidence = Readonly<{
  sourceKind: EpisodeEvidenceSource;
  sourceId: string;
}>;

export type LearnerEpisode<Time = string> = Readonly<{
  id: string;
  studentId: string;
  at: Time;
  kind: EpisodeKind;
  /** Describes what happened; never judges the child. */
  summary: string;
  /** 0..1 — how much this episode should weigh in a brief. */
  importance: number;
  skillCode: string | null;
  sourceSessionId: string;
  /** Same domain as `learner_fact.sensitivity`. */
  sensitivity: string;
  /** `false` keeps the episode out of every prompt, exactly as for facts (P0-23). */
  modelShareable: boolean;
  expiresAt: Time | null;
  supersededBy: string | null;
}>;
