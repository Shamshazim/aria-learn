import { describe, expect, it } from 'vitest';

import {
  PROTOCOL_VERSION,
  tutorInputEventSchema,
  type Band,
  type VisualContent,
} from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import { createInventoryService } from '@/curriculum';
import { buildVisual, firstVisualFor } from '@/curriculum/visuals/show-payloads';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { scrubLearnerContext } from '@/privacy';
import type { ApiModelContext, TurnContentDeps } from '@/services/content/turn-content.types';
import { visualMove } from '@/services/content/turn-visual';
import { createMoveFactory } from '@/services/moves/move-factory';

const NOW = new Date('2026-08-25T20:00:00.000Z');
const INVENTORY = createInventoryService();

function deps(): TurnContentDeps {
  return {
    reliable: { resolve: () => Promise.reject(new Error('not used')) },
    ai: null,
    gate: () => {
      throw new Error('not used');
    },
    moves: (sessionId) =>
      createMoveFactory({ ids: sequentialIds('move'), clock: fixedClock(NOW), sessionId }),
    remediation: () => null,
    visual: (skillCode, problem) => productionVisual(skillCode, problem),
  };
}

/** The same wiring `runtime.ts` uses, so the test is about the decision and not a stub. */
function productionVisual(
  skillCode: string,
  problem: ApiModelContext['arithmeticProblem'],
): VisualContent | null {
  const kind = firstVisualFor(INVENTORY.getSkill(skillCode));
  if (kind === null) return null;
  const caption = INVENTORY.getLesson(skillCode)?.models[0] ?? skillCode;
  return buildVisual({ kind, caption, problem });
}

describe('the visual that goes with a reteach', () => {
  it('shows an early-band child the model the approach promised', () => {
    const move = visualMove(deps(), turn({ band: 'early', approach: 'visual-model' }));

    expect(move).toMatchObject({
      kind: 'SHOW',
      skillId: 'ADD.FACT.10',
      speech: null,
      display: [{ type: 'visual', visual: 'ten-frame' }],
    });
  });

  it('captions it in the words the lesson note uses', () => {
    const move = visualMove(deps(), turn({ band: 'early', approach: 'visual-model' }));
    const shown = move?.display[0];

    expect(shown?.type).toBe('visual');
    expect(shown?.type === 'visual' ? shown.alt : '').toBe(
      INVENTORY.getLesson('ADD.FACT.10')?.models[0],
    );
  });

  it('shows nothing when the reteach chose a different approach', () => {
    expect(visualMove(deps(), turn({ band: 'early', approach: 'worked-example' }))).toBeNull();
  });

  it('shows nothing for a skill with no visual model', () => {
    const rhyme = turn({ band: 'early', approach: 'visual-model', skillCode: 'PA.RHYME' });
    expect(visualMove(deps(), rhyme)).toBeNull();
  });

  it('is an early-band promise: older bands get the words alone', () => {
    expect(visualMove(deps(), turn({ band: 'middle', approach: 'visual-model' }))).toBeNull();
  });
});

function turn(
  input: Readonly<{ band: Band; approach: string; skillCode?: string }>,
): PlannedTurn<ApiModelContext> {
  const skillCode = input.skillCode ?? 'ADD.FACT.10';
  const plan = {
    kind: 'RETEACH' as const,
    approach: input.approach,
    reason: 'test',
    skillCode,
    attempt: 2,
  };
  return {
    event: tutorInputEventSchema.parse({
      id: 'event-1',
      at: NOW.toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      kind: 'CONFUSED',
    }),
    context: {
      session: {
        id: 'session-1',
        studentId: 'student-1',
        subject: 'math',
        grade: '1',
        band: input.band,
        skillCode,
        startedAt: NOW,
        attempts: 1,
        consecutiveWrong: 1,
        consecutiveSilences: 0,
        repeatedMisconception: null,
        lastApproach: 'single-nudge',
        unmetPrerequisite: null,
      },
      modelContext: {
        scrubbed: scrubLearnerContext({ identifiers: {} }, { pseudonym: 'omit' }),
        answerKey: '10',
        latestQuestion: 'What is seven add three?',
        estimatedTokens: 0,
        retrievedFactIds: [],
        recentContentItemIds: [],
        recentIntents: [],
        arithmeticProblem: { skillCode: 'ADD.FACT.10', kind: 'addition', left: '7', right: '3' },
        lesson: INVENTORY.getLesson(skillCode),
        completionOnly: false,
        latestAsk: null,
      },
      recentKinds: [],
    },
    decision: {
      allowedMoves: ['RETEACH'],
      graded: null,
      terminal: false,
      decisive: true,
      reasons: ['test_fixture'],
      defaultPlan: plan,
    },
    plan,
  };
}
