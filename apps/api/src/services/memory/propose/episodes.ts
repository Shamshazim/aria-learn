import type { EpisodeEvidence, EpisodeKind } from '@aria/shared';
import { freshProgress, updateStrength, type SkillProgress } from '@aria/tutor';

import type { GradedAttempt, SessionSpan } from '@/repositories/consolidation-history.repository';
import type { SessionEventRecord } from '@/types/session';

/** What happened in a session that is worth remembering as a moment (P3-02). */
export type EpisodeProposal = Readonly<{
  kind: EpisodeKind;
  at: Date;
  summary: string;
  importance: number;
  skillCode: string | null;
  evidence: readonly [EpisodeEvidence, ...EpisodeEvidence[]];
}>;

/** Computed, never modelled: how much each kind of moment matters. */
export const IMPORTANCE: Readonly<Record<EpisodeKind, number>> = {
  breakthrough: 0.9,
  goal_reached: 0.9,
  preference_change: 0.5,
  struggle: 0.6,
  return_after_absence: 0.4,
  other: 0.3,
};

const BREAKTHROUGH_AT = 0.7;
const BREAKTHROUGH_PRIOR_BELOW = 0.5;
const BREAKTHROUGH_PRIOR_SESSIONS = 2;
const GOAL_AT = 0.8;
const STRUGGLE_RETEACHES = 3;
const ABSENCE_DAYS = 14;
const DAY_MS = 86_400_000;

export type EpisodeInput = Readonly<{
  session: SessionSpan;
  events: readonly SessionEventRecord[];
  previousSession: SessionSpan | null;
  /** Every graded answer the child has given, in order, this session's included. */
  attempts: readonly GradedAttempt[];
  goals: readonly Readonly<{ skillCode: string }>[];
  skillName(code: string): string | null;
  isFacts(code: string): boolean;
}>;

/**
 * The deterministic detectors (P3-02). Each fires on a signature in the evidence and carries
 * the events it saw, so an episode is evidence-backed from birth. A skill the inventory no
 * longer has is skipped: there is no name to describe it by. The summaries describe, never
 * judge, and are written here rather than by a model.
 */
export function detectEpisodes(input: EpisodeInput): readonly EpisodeProposal[] {
  return [...strengthEpisodes(input), ...struggles(input), ...absence(input)];
}

/** "Place value clicked after three weeks", and a goal reached. */
function strengthEpisodes(input: EpisodeInput): readonly EpisodeProposal[] {
  const timeline = replay(input);
  return [...timeline.entries()].flatMap(([skillCode, line]) => {
    const name = input.skillName(skillCode);
    const evidence = sessionEvidence(input, skillCode);
    const at = lastAttemptAt(input, skillCode);
    if (name === null || line.before === null || evidence === null || at === null) return [];
    const proposals: EpisodeProposal[] = [];
    const priorLow = line.priorSessionEnds.filter(
      (strength) => strength < BREAKTHROUGH_PRIOR_BELOW,
    );
    if (
      line.before < BREAKTHROUGH_AT &&
      line.after >= BREAKTHROUGH_AT &&
      priorLow.length >= BREAKTHROUGH_PRIOR_SESSIONS
    ) {
      proposals.push(
        episode({
          kind: 'breakthrough',
          summary: `${name} clicked after several sessions of practice.`,
          skillCode: skillCode,
          evidence: evidence,
          at: at,
        }),
      );
    }
    if (
      input.goals.some((goal) => goal.skillCode === skillCode) &&
      line.before < GOAL_AT &&
      line.after >= GOAL_AT
    ) {
      proposals.push(
        episode({
          kind: 'goal_reached',
          summary: `Reached the goal set for ${name}.`,
          skillCode: skillCode,
          evidence: evidence,
          at: at,
        }),
      );
    }
    return proposals;
  });
}

type Line = { before: number | null; after: number; priorSessionEnds: number[] };

/** Each skill practised this session: its strength before it, after it, and at every earlier session's end. */
function replay(input: EpisodeInput): ReadonlyMap<string, Line> {
  const progress = new Map<string, SkillProgress>();
  const ends = new Map<string, Map<string, number>>();
  const lines = new Map<string, Line>();
  for (const attempt of input.attempts) {
    const before = progress.get(attempt.skillCode) ?? freshProgress(attempt.skillCode);
    const after = updateStrength(
      before,
      { correct: attempt.correct, latencyMs: attempt.latencyMs },
      input.isFacts(attempt.skillCode),
      attempt.at,
    );
    progress.set(attempt.skillCode, after);
    if (attempt.sessionId === input.session.id) {
      const line = lines.get(attempt.skillCode);
      const prior = [...(ends.get(attempt.skillCode)?.values() ?? [])];
      lines.set(attempt.skillCode, {
        before: line?.before ?? (before.attempts === 0 ? 0 : before.strength),
        after: after.strength,
        priorSessionEnds: line?.priorSessionEnds ?? prior,
      });
    } else {
      const bySession = ends.get(attempt.skillCode) ?? new Map<string, number>();
      bySession.set(attempt.sessionId, after.strength);
      ends.set(attempt.skillCode, bySession);
    }
  }
  return lines;
}

function lastAttemptAt(input: EpisodeInput, skillCode: string): Date | null {
  const own = input.attempts.filter(
    (attempt) => attempt.sessionId === input.session.id && attempt.skillCode === skillCode,
  );
  return own.at(-1)?.at ?? null;
}

function sessionEvidence(
  input: EpisodeInput,
  skillCode: string,
): readonly [EpisodeEvidence, ...EpisodeEvidence[]] | null {
  const ids = input.attempts
    .filter((attempt) => attempt.sessionId === input.session.id && attempt.skillCode === skillCode)
    .map((attempt) => attempt.eventId);
  return evidenceOf(ids);
}

/** Three reteaches on one skill, or being taken back a step because it was not working. */
function struggles(input: EpisodeInput): readonly EpisodeProposal[] {
  const bySkill = new Map<string, string[]>();
  const lastAt = new Map<string, Date>();
  let practising: string | null = null;
  for (const event of input.events) {
    if (event.actor === 'child' && event.skillCode !== null) practising = event.skillCode;
    if (event.actor !== 'aria') continue;
    const stepBack = event.kind === 'SWITCH' && event.evidence.approach === 'prerequisite-step';
    const skill = event.kind === 'RETEACH' ? event.skillCode : stepBack ? practising : null;
    if (skill === null) continue;
    bySkill.set(skill, [...(bySkill.get(skill) ?? []), `${event.kind}:${event.id}`]);
    lastAt.set(skill, event.at);
  }
  return [...bySkill.entries()].flatMap(([skillCode, marks]) => {
    const name = input.skillName(skillCode);
    const reteaches = marks.filter((mark) => mark.startsWith('RETEACH:')).length;
    const steppedBack = marks.some((mark) => mark.startsWith('SWITCH:'));
    const evidence = evidenceOf(marks.map((mark) => mark.slice(mark.indexOf(':') + 1)));
    const at = lastAt.get(skillCode);
    if (name === null || evidence === null || at === undefined) return [];
    if (reteaches < STRUGGLE_RETEACHES && !steppedBack) return [];
    const summary = `${name} was hard going this session; Aria tried it another way.`;
    return [
      episode({
        kind: 'struggle',
        summary: summary,
        skillCode: skillCode,
        evidence: evidence,
        at: at,
      }),
    ];
  });
}

/** Back after two weeks or more away. */
function absence(input: EpisodeInput): readonly EpisodeProposal[] {
  const previous = input.previousSession;
  const first = input.events[0];
  if (previous === null || first === undefined) return [];
  const away =
    input.session.startedAt.getTime() - (previous.endedAt ?? previous.startedAt).getTime();
  const days = Math.floor(away / DAY_MS);
  if (days < ABSENCE_DAYS) return [];
  return [
    episode({
      kind: 'return_after_absence',
      summary: `Came back after ${String(days)} days away.`,
      skillCode: null,
      evidence: [{ sourceKind: 'session_event', sourceId: first.id }],
      at: first.at,
    }),
  ];
}

/** P3-02: a preference that changed is a moment too; the conflict rules notice it. */
export function preferenceChange(text: string, sourceEventId: string, at: Date): EpisodeProposal {
  return episode({
    kind: 'preference_change',
    summary: `Changed what they like: ${text}`,
    skillCode: null,
    evidence: [{ sourceKind: 'session_event', sourceId: sourceEventId }],
    at: at,
  });
}

function episode(
  input: Readonly<{
    kind: EpisodeKind;
    summary: string;
    skillCode: string | null;
    evidence: readonly [EpisodeEvidence, ...EpisodeEvidence[]];
    at: Date;
  }>,
): EpisodeProposal {
  return { ...input, importance: IMPORTANCE[input.kind] };
}

function evidenceOf(
  ids: readonly string[],
): readonly [EpisodeEvidence, ...EpisodeEvidence[]] | null {
  const [first, ...rest] = [...new Set(ids)].map((sourceId) => ({
    sourceKind: 'session_event' as const,
    sourceId,
  }));
  return first === undefined ? null : [first, ...rest];
}
