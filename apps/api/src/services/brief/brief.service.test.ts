import { describe, expect, it, vi } from 'vitest';

import { createAiClient, type AiClientDependencies } from '@/ai';
import { learnerBriefPrompt } from '@/ai/prompts/definitions/learner-brief.prompt';
import type { LearnerBriefPromptInput } from '@/ai/prompts/types';
import { fixedClock } from '@/lib/clock';
import { scrubLearnerContext } from '@/privacy';
import type { LearnerFact } from '@/types/memory';
import type { NewLearnerBrief, BriefRecord, EpisodeRecord } from '@/types/memory-history';
import type { SkillState } from '@/types/skill-state';

import { createBriefService } from './brief.service';
import { describeNotJudge } from './lint/describe-not-judge';
import { WORD_CAP } from './period';

type Provider = AiClientDependencies['provider'];
type LlmRequest = Parameters<Provider['complete']>[0];

const NOW = new Date('2026-11-12T18:00:00.000Z'); // a Thursday
const STUDENT = 'student-1';

function fact(id: string, text: string): LearnerFact {
  return {
    id,
    studentId: STUDENT,
    kind: 'preference',
    value: { text },
    confidence: 0.9,
    firstObservedAt: NOW,
    lastConfirmedAt: NOW,
    expiresAt: null,
    sensitivity: 'normal',
    modelShareable: true,
    supersededBy: null,
  };
}

function episode(id: string, summary: string): EpisodeRecord {
  return {
    id,
    studentId: STUDENT,
    at: new Date('2026-11-11T17:00:00.000Z'),
    kind: 'breakthrough',
    summary,
    importance: 0.8,
    skillCode: null,
    sourceSessionId: 'session-1',
    sensitivity: 'normal',
    modelShareable: true,
    expiresAt: null,
    supersededBy: null,
  };
}

const SKILL: SkillState = {
  studentId: STUDENT,
  skillCode: 'ADD.FACT.10',
  strength: 0.5,
  attempts: 6,
  correctStreak: 2,
  lapses: 1,
  intervalDays: 3,
  lastSeenAt: new Date('2026-11-11T17:05:00.000Z'),
  nextDueAt: null,
};

/** A model that writes one sentence per piece of evidence it was offered, citing it. */
function echoingProvider(
  requests: LlmRequest[],
  say?: (ref: string, text: string) => string,
): Provider {
  const complete = vi.fn((request: LlmRequest) => {
    requests.push(request);
    const lines = [...request.user.matchAll(/^\[([FES]\d+)\] (.+)$/gmu)];
    const sentences = lines.map(([, ref = '', text = '']) => ({
      text: say?.(ref, text) ?? `[child] ${text.replace(/\.$/u, '')}.`,
      refs: [ref],
    }));
    return Promise.resolve({
      text: JSON.stringify({ sentences }),
      endpointName: 'teach',
      model: 'fake',
      tokensIn: 1,
      tokensOut: 1,
      costUsd: 0,
      latencyMs: 1,
      finishReason: 'stop' as const,
    });
  });
  return {
    complete,
    stream: async function* () {
      yield await Promise.reject(new Error('not used'));
    },
  };
}

function harness(
  options: Readonly<{
    facts?: LearnerFact[];
    episodes?: EpisodeRecord[];
    sessions?: number;
    skills?: SkillState[];
    provider?: Provider | null;
    safe?: (text: string) => boolean;
  }> = {},
) {
  const requests: LlmRequest[] = [];
  const written: NewLearnerBrief[] = [];
  const facts = options.facts ?? [fact('f1', 'Loves mystery stories.')];
  const logger = { info: vi.fn(), warn: vi.fn() };
  const provider = options.provider === undefined ? echoingProvider(requests) : options.provider;
  const service = createBriefService({
    sources: {
      facts: { listCurrent: () => Promise.resolve(facts) },
      episodes: {
        listCurrent: () =>
          Promise.resolve(options.episodes ?? [episode('e1', 'Read a whole page aloud.')]),
      },
      skills: { listForStudent: () => Promise.resolve(options.skills ?? [SKILL]) },
      sessions: { countSessions: () => Promise.resolve(options.sessions ?? 3) },
      skillName: (code) => (code === 'ADD.FACT.10' ? 'Addition facts to 10' : null),
    },
    briefs: {
      insertVersion: (input) => {
        written.push(input);
        return Promise.resolve({
          ...input,
          id: `brief-${String(written.length)}`,
          version: written.length,
          supersededBy: null,
        } as BriefRecord);
      },
      history: () => Promise.resolve([]),
    },
    students: {
      requireById: () =>
        Promise.resolve({
          id: STUDENT,
          parentId: 'parent-1',
          displayName: 'Priya Shah',
          grade: '2',
          band: 'early',
          settings: { shareFirstName: true, pronunciation: null, avatar: 'owl' },
          isSynthetic: false,
          createdAt: NOW,
        }),
    },
    ai:
      provider === null
        ? null
        : createAiClient({
            provider,
            accounting: {
              assertWithinCap: () => Promise.resolve(),
              record: () => Promise.resolve(),
              recordCachedHit: () => Promise.resolve(),
            },
            now: () => 0,
          }),
    safe: options.safe ?? (() => true),
    clock: fixedClock(NOW),
    logger,
  });
  return { service, requests, written, logger };
}

describe('the learner brief (P3-03)', () => {
  it.each(['week', 'month', 'year'] as const)(
    'writes a %s brief within its cap that passes the lint',
    async (period) => {
      const { service, written } = harness();
      const brief = await service.generate({ studentId: STUDENT, period, periodStart: NOW });
      expect(brief).not.toBeNull();
      const body = written[0]?.body ?? '';
      expect(body.split(/\s+/u).length).toBeLessThanOrEqual(WORD_CAP[period]);
      expect(describeNotJudge(body)).toEqual([]);
      expect(written[0]?.generator).toBe('learner-brief@1.0.0');
    },
  );

  it('puts the first name in the stored body and never in a model request', async () => {
    const { service, written, requests } = harness();
    await service.generate({ studentId: STUDENT, period: 'week', periodStart: NOW });
    expect(written[0]?.body).toContain('Priya');
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      expect(`${request.system}\n${request.user}`).not.toMatch(/Priya|Shah/u);
    }
  });

  it('files the week under its Monday and records the evidence each sentence used', async () => {
    const { service, written } = harness();
    await service.generate({ studentId: STUDENT, period: 'week', periodStart: NOW });
    expect(written[0]).toMatchObject({
      periodStart: '2026-11-09',
      evidenceSnapshot: { factIds: ['f1'], episodeIds: ['e1'], skillCodes: ['ADD.FACT.10'] },
    });
    expect(written[0]?.body).toContain('Addition facts to 10');
    expect(written[0]?.body).not.toContain('ADD.FACT.10');
  });

  it('drops the sentence a removed fact supported, when it regenerates', async () => {
    const both = harness({
      facts: [fact('f1', 'Loves mystery stories.'), fact('f2', 'Prefers short questions.')],
    });
    await both.service.generate({ studentId: STUDENT, period: 'week', periodStart: NOW });
    expect(both.written[0]?.body).toContain('short questions');
    const one = harness({ facts: [fact('f1', 'Loves mystery stories.')] });
    await one.service.generate({ studentId: STUDENT, period: 'week', periodStart: NOW });
    expect(one.written[0]?.body).not.toContain('short questions');
    expect(one.written[0]?.evidenceSnapshot.factIds).toEqual(['f1']);
  });

  it('cannot be given the previous brief: the type has no field for it, and the schema refuses one', () => {
    const input: LearnerBriefPromptInput = {
      context: scrubLearnerContext({ identifiers: {} }, { pseudonym: 'omit' }),
      period: 'week',
      wordCap: 120,
      sessions: 1,
      facts: [],
      episodes: [],
      skills: [],
      avoid: [],
      // @ts-expect-error — there is no previous-body field, and that is the point (§4.2).
      previousBody: 'Last week Priya…',
    };
    expect(Object.keys(learnerBriefPrompt.inputSchema)).toBeDefined();
    expect(learnerBriefPrompt.inputSchema.safeParse(input).success).toBe(false);
  });

  it('regenerates once with what was wrong, then writes the template and logs it', async () => {
    const requests: LlmRequest[] = [];
    const judging = echoingProvider(requests, () => '[child] is a gifted reader.');
    const { service, written, logger } = harness({ provider: judging });
    await service.generate({ studentId: STUDENT, period: 'week', periodStart: NOW });
    expect(requests).toHaveLength(2);
    expect(requests[1]?.user).toContain('uses the label "gifted"');
    expect(written[0]?.generator).toBe('template');
    expect(written[0]?.body).not.toContain('gifted');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'brief.lint.failed' }),
      expect.any(String),
    );
  });

  it('writes the template when no model is configured, still citing its evidence', async () => {
    const { service, written } = harness({ provider: null });
    await service.generate({ studentId: STUDENT, period: 'week', periodStart: NOW });
    expect(written[0]).toMatchObject({ generator: 'template' });
    expect(written[0]?.body).toContain('Priya had 3 sessions with Aria this week.');
    expect(written[0]?.evidenceSnapshot.factIds).toEqual(['f1']);
  });

  it("writes the template when the model's paragraph fails the safety check", async () => {
    const { service, written } = harness({
      safe: (text) => !text.includes('mystery stories') || text.includes('sessions'),
    });
    await service.generate({ studentId: STUDENT, period: 'week', periodStart: NOW });
    expect(written[0]?.generator).toBe('template');
  });

  it('writes nothing for a week with no sessions, or a child with no evidence at all', async () => {
    const quietWeek = harness({ sessions: 0 });
    expect(
      await quietWeek.service.generate({ studentId: STUDENT, period: 'week', periodStart: NOW }),
    ).toBeNull();
    expect(
      await quietWeek.service.generate({ studentId: STUDENT, period: 'month', periodStart: NOW }),
    ).not.toBeNull();
    const newChild = harness({ sessions: 0, facts: [], episodes: [], skills: [] });
    expect(
      await newChild.service.generate({ studentId: STUDENT, period: 'month', periodStart: NOW }),
    ).toBeNull();
  });
});

describe('the brief lint', () => {
  it('fails a fixture holding every kind of label and score', () => {
    const fixture =
      'Priya is gifted, slow and lazy. She is behind in maths, may have ADHD and is dyslexic. Her IQ is high; she is in the 90th percentile, scored 85% and got a B+.';
    const violations = describeNotJudge(fixture);
    for (const expected of ['gifted', 'slow', 'lazy', 'adhd', 'dyslexic', 'iq', 'percentile']) {
      expect(violations.join(' ')).toContain(`"${expected}"`);
    }
    expect(violations).toContain('calls the child "behind"');
    expect(violations).toContain('gives a score, percentage or grade');
  });

  it('passes a clean, specific paragraph', () => {
    expect(
      describeNotJudge(
        'Priya had three sessions this week. She practised Addition facts to 10 and read a whole page aloud on Tuesday. She still loves mystery stories.',
      ),
    ).toEqual([]);
  });
});
