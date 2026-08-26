import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema, type MoveKind } from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import { scrubLearnerContext } from '@/privacy';
import { createQualityGate, type MoveClaims } from '@/quality';
import {
  praiseInputs,
  praiseStreak,
  revealInputs,
  endInputs,
} from '@/services/content/move-inputs';
import { PRAISE_CASES } from '@/services/content/move-inputs/__fixtures__/praise.fixtures';
import { REVEAL_CASES } from '@/services/content/move-inputs/__fixtures__/reveal.fixtures';
import type { ApiModelContext } from '@/services/content/turn-content.types';
import type { SessionRecap } from '@/services/session/recap.types';

const NOW = new Date('2026-08-25T10:00:00.000Z');
const gate = createQualityGate(() => ({ safe: true, categories: [] }));

function verdictFor(text: string, claims: MoveClaims): readonly string[] {
  const verdict = gate({
    id: 'case',
    kind: 'text',
    band: 'senior',
    childText: text,
    factual: false,
    grounding: 'unsupported',
    claims,
  });
  return verdict.verdict === 'fail' ? verdict.reasons.map((reason) => reason.code) : [];
}

describe('praise grounding', () => {
  it.each(PRAISE_CASES)('$name', (praiseCase) => {
    const codes = verdictFor(praiseCase.text, { move: 'praise', allowed: praiseCase.allowed });
    if (praiseCase.verdict === 'pass') expect(codes).toEqual([]);
    else expect(codes).toContain(praiseCase.code);
  });

  it('offers only the strategies the grader vouched for', () => {
    const turn = praiseTurn(['regrouped']);
    const inputs = praiseInputs(turn);
    expect(inputs.claims?.allowed).toContain('regrouped');
    expect(inputs.claims?.allowed).not.toContain('counted-on');
    expect(inputs.lines.join(' ')).toContain('regrouped when the ones went past nine');
  });

  it('says plainly when it knows nothing about how the answer was reached', () => {
    const inputs = praiseInputs(praiseTurn([], 40_000));
    expect(inputs.claims?.allowed).toEqual([]);
    expect(inputs.lines.join(' ')).toContain('nothing about how');
  });

  it('earns "answered quickly" only from an answer that actually came quickly', () => {
    expect(praiseInputs(praiseTurn([], 4_000)).claims?.allowed).toContain('answered-quickly');
    expect(praiseInputs(praiseTurn([], 40_000)).claims?.allowed).not.toContain('answered-quickly');
  });

  it('earns "kept going" from an attempt that followed wrong ones', () => {
    const base = praiseTurn([]);
    const turn = {
      ...base,
      context: {
        ...base.context,
        session: { ...base.context.session, consecutiveWrong: 2, lastApproach: 'simpler-case' },
      },
    };
    expect(praiseInputs(turn).claims?.allowed).toEqual(
      expect.arrayContaining(['kept-going', 'tried-another-way']),
    );
  });

  /** P2H-11: the fourth cheer in a row is noise. */
  it('asks for a quieter praise after three in a row', () => {
    const base = praiseTurn([]);
    const turn = {
      ...base,
      context: { ...base.context, recentKinds: ['PRAISE', 'ASK', 'PRAISE', 'ASK', 'PRAISE'] },
    };
    expect(praiseStreak(turn.context.recentKinds)).toBe(3);
    expect(praiseInputs(turn).lines.join(' ')).toContain('Say less this time');
  });

  it('refuses to praise an answer the child was just handed', () => {
    const base = praiseTurn([]);
    const turn = {
      ...base,
      context: { ...base.context, recentKinds: ['ASK', 'REVEAL', 'ASK'] },
    };
    expect(praiseInputs(turn).lines.join(' ')).toContain('Do not praise the answer itself');
  });
});

describe('reveal shape', () => {
  it.each(REVEAL_CASES)('$name', (revealCase) => {
    const base = praiseTurn([]);
    const turn = {
      ...base,
      plan: { ...base.plan, kind: 'REVEAL' as MoveKind },
      context: {
        ...base.context,
        modelContext: { ...base.context.modelContext, answerKey: revealCase.answer },
      },
    };
    const claims = revealInputs(turn, revealCase.idea).claims;
    if (claims === undefined) throw new Error('A reveal always carries claims');
    const codes = verdictFor(revealCase.text, claims);
    if (revealCase.verdict === 'pass') expect(codes).toEqual([]);
    else expect(codes).toContain(revealCase.code);
  });
});

describe('the ending', () => {
  it('gives the model the counts and forbids the child hearing them', () => {
    const inputs = endInputs(endTurn(), recap());
    const claims = inputs.claims;
    if (claims === undefined) throw new Error('An ending always carries claims');
    expect(inputs.lines.join(' ')).toContain('Never say a number');
    expect(claims).toMatchObject({ move: 'end' });
    expect(verdictFor('You worked on adding today. See you next time.', claims)).toEqual([]);
    expect(verdictFor('You got 3 out of 4 today. See you soon.', claims)).toContain(
      'scored_ending',
    );
  });

  it('names the moment worth naming', () => {
    expect(endInputs(endTurn(), recap()).lines.join(' ')).toContain(
      'came back to Add two-digit numbers with regrouping',
    );
  });

  it('does not pretend work was done in a session with no answers', () => {
    const empty: SessionRecap = {
      skills: [],
      attempted: 0,
      correct: 0,
      finalStreak: 0,
      moment: null,
    };
    expect(endInputs(endTurn(), empty).lines.join(' ')).toContain(
      'without pretending work was done',
    );
  });
});

function recap(): SessionRecap {
  return {
    skills: [{ code: 'ADD.REGROUP.2D', name: 'Add two-digit numbers with regrouping' }],
    attempted: 4,
    correct: 3,
    finalStreak: 2,
    moment: {
      kind: 'after-reteach',
      skillCode: 'ADD.REGROUP.2D',
      skillName: 'Add two-digit numbers with regrouping',
    },
  };
}

function endTurn(): PlannedTurn<ApiModelContext> {
  const base = praiseTurn([]);
  return { ...base, plan: { ...base.plan, kind: 'END' } };
}

function praiseTurn(
  strategies: readonly string[],
  elapsedMs = 4_000,
): PlannedTurn<ApiModelContext> {
  const event = tutorInputEventSchema.parse({
    id: 'event-1',
    at: NOW.toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    kind: 'ANSWER',
    sessionId: '00000000-0000-4000-8000-000000000001',
    respondsTo: 'move-1',
    text: '42',
    elapsedMs,
  });
  const plan = {
    kind: 'PRAISE' as MoveKind,
    approach: 'default',
    reason: 'test',
    skillCode: 'ADD.REGROUP.2D',
    attempt: 1,
  };
  return {
    event,
    plan,
    decision: {
      allowedMoves: ['PRAISE'],
      graded: { correct: true, misconception: null, strategies },
      terminal: false,
      decisive: true,
      reasons: [],
      defaultPlan: plan,
    },
    context: {
      recentKinds: [],
      session: {
        id: 'session-1',
        studentId: 'student-1',
        subject: 'math',
        grade: '4',
        band: 'middle',
        skillCode: 'ADD.REGROUP.2D',
        startedAt: NOW,
        attempts: 1,
        consecutiveWrong: 0,
        consecutiveSilences: 0,
        repeatedMisconception: null,
        lastApproach: null,
        unmetPrerequisite: null,
      },
      modelContext: {
        scrubbed: scrubLearnerContext(
          { identifiers: {}, gradeBand: 'middle' },
          { pseudonym: 'omit' },
        ),
        answerKey: '42',
        latestQuestion: 'What is 27 plus 15?',
        estimatedTokens: 0,
        retrievedFactIds: [],
        recentContentItemIds: [],
        recentIntents: [],
        arithmeticProblem: null,
        lesson: null,
        completionOnly: false,
        latestAsk: null,
      },
    },
  };
}
