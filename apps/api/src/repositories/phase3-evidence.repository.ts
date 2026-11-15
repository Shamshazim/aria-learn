import { z } from 'zod';

import type { Queryable } from '@/db/types';

export type Phase3DatabaseEvidence = Readonly<{
  welcomes: Readonly<{ cohort: number; evidenceBacked: number }>;
  evidenceLinks: Readonly<{
    facts: number;
    factsWithoutEvidence: number;
    episodes: number;
    episodesWithoutEvidence: number;
  }>;
  engagementFactsCreated: number;
  /** `null` when no rebuild has finished for anyone yet. */
  rebuild: Readonly<{ students: number; maxDrift: number }> | null;
}>;

export type Phase3EvidenceRepository = Readonly<{ load(): Promise<Phase3DatabaseEvidence> }>;

/** The welcome kinds that name a fact or a recent event, as `welcome.composer.ts` writes them. */
const EVIDENCE_WELCOMES = ['evidence_fact', 'evidence_recent'] as const;

/** Fact kinds that would be a passing state made permanent; P3-05 keeps them off durable memory. */
const ENGAGEMENT_KINDS = ['mood', 'engagement', 'affect', 'frustration', 'fatigue'] as const;

/**
 * Every statement the Phase 3 report issues (P3-08), in one block. Read-only: the report
 * measures, it never writes, and a rebuild it reads is one somebody already ran.
 */
const SQL = {
  // The latest arrival of each student who finished a session in the fortnight before it: a
  // returning child the welcome should know. A longer gap gets the long-absence welcome by
  // design, so those children are not in the cohort.
  welcomes: `
    WITH latest AS (
      SELECT DISTINCT ON (student_id) student_id, at, welcome_kind
        FROM arrival_event ORDER BY student_id, at DESC
    )
    SELECT COUNT(*)::int AS cohort,
           COUNT(*) FILTER (WHERE welcome_kind = ANY($1::text[]))::int AS evidence_backed
      FROM latest l
     WHERE EXISTS (
       SELECT 1 FROM session s
        WHERE s.student_id = l.student_id
          AND s.ended_at IS NOT NULL
          AND s.ended_at < l.at
          AND s.ended_at >= l.at - INTERVAL '14 days'
     )`,
  evidenceLinks: `
    SELECT
      (SELECT COUNT(*)::int FROM learner_fact) AS facts,
      (SELECT COUNT(*)::int FROM learner_fact f
        WHERE NOT EXISTS (SELECT 1 FROM learner_fact_evidence e WHERE e.fact_id = f.id)) AS facts_without,
      (SELECT COUNT(*)::int FROM learner_episode) AS episodes,
      (SELECT COUNT(*)::int FROM learner_episode p
        WHERE NOT EXISTS (SELECT 1 FROM learner_episode_evidence e WHERE e.episode_id = p.id)) AS episodes_without`,
  engagementFacts: `SELECT COUNT(*)::int AS n FROM learner_fact WHERE kind = ANY($1::text[])`,
  // The latest finished rebuild for each student, and the worst drift among them.
  rebuild: `
    WITH latest AS (
      SELECT DISTINCT ON (student_id) student_id, drift_score
        FROM memory_rebuild_run WHERE finished_at IS NOT NULL
       ORDER BY student_id, finished_at DESC
    )
    SELECT COUNT(*)::int AS students, MAX(drift_score)::float AS max_drift FROM latest`,
} as const;

const welcomeRow = z.object({ cohort: z.number().int(), evidence_backed: z.number().int() });
const linkRow = z.object({
  facts: z.number().int(),
  facts_without: z.number().int(),
  episodes: z.number().int(),
  episodes_without: z.number().int(),
});
const countRow = z.object({ n: z.number().int() });
const rebuildRow = z.object({ students: z.number().int(), max_drift: z.number().nullable() });

export function createPhase3EvidenceRepository(db: Queryable): Phase3EvidenceRepository {
  return {
    load: async () => {
      const [welcomes, links, engagement, rebuild] = await Promise.all([
        db.query(SQL.welcomes, [EVIDENCE_WELCOMES]),
        db.query(SQL.evidenceLinks),
        db.query(SQL.engagementFacts, [ENGAGEMENT_KINDS]),
        db.query(SQL.rebuild),
      ]);
      const welcome = welcomeRow.parse(welcomes.rows[0]);
      const link = linkRow.parse(links.rows[0]);
      const run = rebuildRow.parse(rebuild.rows[0]);
      return {
        welcomes: { cohort: welcome.cohort, evidenceBacked: welcome.evidence_backed },
        evidenceLinks: {
          facts: link.facts,
          factsWithoutEvidence: link.facts_without,
          episodes: link.episodes,
          episodesWithoutEvidence: link.episodes_without,
        },
        engagementFactsCreated: countRow.parse(engagement.rows[0]).n,
        rebuild:
          run.students === 0 || run.max_drift === null
            ? null
            : { students: run.students, maxDrift: run.max_drift },
      };
    },
  };
}
