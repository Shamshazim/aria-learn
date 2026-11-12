import type { BriefPeriod } from '@aria/shared';

import type { AiClient } from '@/ai';
import { BRIEF_CHILD_TOKEN } from '@/ai/prompts/definitions/learner-brief.prompt';
import type { Clock } from '@/lib/clock';
import type { Logger } from '@/lib/logger';
import { scrubLearnerContext, type ScrubbedContext } from '@/privacy';
import { firstNameOf } from '@/privacy/rules/identifiers';
import type { LearnerBriefRepository } from '@/repositories/learner-brief.repository';
import type { StudentRepository } from '@/repositories/student.repository';

import { buildBriefPromptInput, type EvidenceRefs } from './brief.prompt.input';
import {
  bodyOf,
  lintBody,
  snapshotOf,
  templateSentences,
  traceable,
  type BriefSentence,
} from './compose';
import { collectEvidence, isEmpty, type EvidenceSources } from './evidence.collector';
import { periodWindow, WORD_CAP } from './period';

import type { BriefEvidence, BriefService } from './types';

/** `currentForTurn` uses a week brief only this recently written for (§4.2: "this week"). */
const RECENT_DAYS = 14;
export const TEMPLATE_GENERATOR = 'template';

type Deps = Readonly<{
  sources: EvidenceSources;
  briefs: Pick<LearnerBriefRepository, 'insertVersion' | 'history'>;
  students: Pick<StudentRepository, 'requireById'>;
  /** `null` where no model is configured: every brief is then the template. */
  ai: AiClient | null;
  /** The P0-18 safety check, as any model-written text gets; a parent reads it. */
  safe(text: string): boolean;
  clock: Clock;
  logger: Pick<Logger, 'info' | 'warn'>;
  schoolYearStartMonth?: number;
}>;

/**
 * The learner brief (P3-03, `master-plan.md` §4.2 Layer 4): a short paragraph a parent can read
 * and the tutor opens a session knowing, written from current evidence — never from the brief
 * before it — versioned by week, month and school year.
 *
 * The model sees the evidence scrubbed, with the child as `[child]`; the first name goes back
 * in afterwards, so it is in the stored body and never in a request. The lint runs after the
 * model and before the write; a failure regenerates once with what was wrong, and a second
 * failure writes the plain template instead and says so in the log.
 */
export function createBriefService(deps: Deps): BriefService {
  return {
    generate: (input) => generate(deps, input),
    currentForTurn: (studentId, now) => currentForTurn(deps, studentId, now),
  };
}

async function generate(
  deps: Deps,
  input: Readonly<{ studentId: string; period: BriefPeriod; periodStart: Date }>,
) {
  const window = periodWindow(input.period, input.periodStart, deps.schoolYearStartMonth);
  const now = deps.clock.now();
  const evidence = await collectEvidence(deps.sources, input.studentId, window, now);
  const skipped = skipReason(input.period, evidence);
  if (skipped !== null) {
    deps.logger.info(
      { event: 'brief.skipped', studentId: input.studentId, period: input.period, reason: skipped },
      'No brief: nothing to say',
    );
    return null;
  }
  const student = await deps.students.requireById(input.studentId);
  const context = scrubLearnerContext(
    { identifiers: { fullName: student.displayName }, gradeBand: student.band },
    { pseudonym: 'omit' },
  );
  const cap = WORD_CAP[input.period];
  // The references are fixed by the evidence; each attempt below rebuilds the same ones.
  const { refs } = buildBriefPromptInput({
    context,
    period: input.period,
    wordCap: cap,
    evidence,
    avoid: [],
  });
  const drafted = await draft(deps, {
    context,
    period: input.period,
    cap,
    evidence,
    refs,
    studentId: input.studentId,
  });
  const { sentences, generator, body } = safeOrTemplate(deps, {
    drafted,
    template: () => templateSentences(evidence, input.period, refs, cap),
    firstName: firstNameOf(student.displayName),
    studentId: input.studentId,
  });
  return deps.briefs.insertVersion({
    studentId: input.studentId,
    period: input.period,
    periodStart: window.periodStart,
    writtenAt: now,
    body,
    evidenceSnapshot: await freshSnapshot(deps, {
      studentId: input.studentId,
      sentences,
      refs,
      now,
    }),
    generator,
  });
}

/**
 * The P0-18 safety check on the finished paragraph, name and all. A model paragraph that fails
 * it is replaced by the template, which says only what the evidence said.
 */
function safeOrTemplate(
  deps: Deps,
  input: Readonly<{
    drafted: Drafted;
    template: () => readonly BriefSentence[];
    firstName: string | undefined;
    studentId: string;
  }>,
): Drafted & Readonly<{ body: string }> {
  const body = named(bodyOf(input.drafted.sentences), input.firstName);
  if (deps.safe(body)) return { ...input.drafted, body };
  deps.logger.warn(
    { event: 'brief.safety.failed', studentId: input.studentId },
    'A brief failed the safety check; the template was written',
  );
  const sentences = input.template();
  return {
    sentences,
    generator: TEMPLATE_GENERATOR,
    body: named(bodyOf(sentences), input.firstName),
  };
}

function skipReason(period: BriefPeriod, evidence: BriefEvidence): string | null {
  if (isEmpty(evidence)) return 'no_evidence';
  // A week with no sessions has nothing in it; standing facts are what month and year are for.
  if (period === 'week' && evidence.sessions === 0) return 'no_sessions';
  return null;
}

type Drafted = Readonly<{ sentences: readonly BriefSentence[]; generator: string }>;

async function draft(
  deps: Deps,
  input: Readonly<{
    context: ScrubbedContext;
    period: BriefPeriod;
    cap: number;
    evidence: BriefEvidence;
    refs: EvidenceRefs;
    studentId: string;
  }>,
): Promise<Drafted> {
  const template = (): Drafted => ({
    sentences: templateSentences(input.evidence, input.period, input.refs, input.cap),
    generator: TEMPLATE_GENERATOR,
  });
  if (deps.ai === null) return template();
  let avoid: readonly string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { prompt } = buildBriefPromptInput({ ...input, wordCap: input.cap, avoid });
    let result;
    try {
      result = await deps.ai.run('learner-brief', prompt, { studentId: input.studentId });
    } catch (error) {
      deps.logger.warn(
        { event: 'brief.model.unavailable', err: error, studentId: input.studentId },
        'The brief model did not answer; the template was written',
      );
      return template();
    }
    const sentences = traceable(result.data.sentences, input.refs);
    const violations =
      sentences.length === 0
        ? ['said nothing the evidence supports']
        : lintBody(bodyOf(sentences), input.cap);
    if (violations.length === 0) {
      return { sentences, generator: `learner-brief@${result.metadata.promptVersion}` };
    }
    avoid = violations;
  }
  deps.logger.warn(
    { event: 'brief.lint.failed', studentId: input.studentId, violations: avoid },
    'The brief failed the lint twice; the template was written',
  );
  return template();
}

/** The first name goes back in here, after the model, so it never travels in a request. */
function named(body: string, firstName: string | undefined): string {
  return body.split(BRIEF_CHILD_TOKEN).join(firstName ?? 'Your child');
}

/** A row superseded between collection and write is dropped from what the brief claims. */
async function freshSnapshot(
  deps: Deps,
  input: Readonly<{
    studentId: string;
    sentences: readonly BriefSentence[];
    refs: EvidenceRefs;
    now: Date;
  }>,
) {
  const { studentId, sentences, refs, now } = input;
  const snapshot = snapshotOf(sentences, refs);
  const [facts, episodes] = await Promise.all([
    deps.sources.facts.listCurrent(studentId, now),
    deps.sources.episodes.listCurrent(studentId, now),
  ]);
  const currentFacts = new Set(facts.map((fact) => fact.id));
  const currentEpisodes = new Set(episodes.map((episode) => episode.id));
  return {
    factIds: snapshot.factIds.filter((id) => currentFacts.has(id)),
    episodeIds: snapshot.episodeIds.filter((id) => currentEpisodes.has(id)),
    skillCodes: snapshot.skillCodes,
  };
}

async function currentForTurn(deps: Deps, studentId: string, now: Date): Promise<string | null> {
  const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000).toISOString().slice(0, 10);
  const history = await deps.briefs.history(studentId, 'week');
  const current = history.find(
    (brief) => brief.supersededBy === null && brief.periodStart >= since,
  );
  return current === undefined || current.body.trim() === '' ? null : current.body;
}
