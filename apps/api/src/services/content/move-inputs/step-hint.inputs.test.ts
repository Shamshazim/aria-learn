import { describe, expect, it } from 'vitest';

import type { PlannedTurn } from '@aria/tutor';

import { createQualityGate } from '@/quality';
import { praiseTurn } from '@/services/content/move-inputs/__fixtures__/turns.fixture';
import { stepHintInputs } from '@/services/content/move-inputs/step-hint.inputs';
import type { ApiModelContext } from '@/services/content/turn-content.types';

/** A hint planned at one step of 157 ÷ 4, built from the shared fixture turn. */
function stepTurn(step: number): PlannedTurn<ApiModelContext> {
  const base = praiseTurn([]);
  return {
    ...base,
    plan: {
      ...base.plan,
      kind: 'HINT',
      approach: 'point-to-step',
      evidence: { procedureStep: step, procedureSteps: 4 },
    },
    context: {
      ...base.context,
      modelContext: {
        ...base.context.modelContext,
        answerKey: '39 r 1',
        arithmeticProblem: { skillCode: 'DIV.LONG', kind: 'division', left: '157', right: '4' },
      },
    },
  };
}

const gate = createQualityGate(() => ({ safe: true, categories: [] }));

function verdict(text: string, step: number) {
  return gate({
    id: 'hint',
    kind: 'text',
    band: 'middle',
    childText: text,
    factual: false,
    grounding: 'reviewed-bank',
    ...(stepHintInputs(stepTurn(step)).claims === undefined
      ? {}
      : { claims: stepHintInputs(stepTurn(step)).claims }),
  });
}

describe('a step hint (P3-07)', () => {
  it('names the step it points at', () => {
    expect(stepHintInputs(stepTurn(3)).lines[0]).toBe(
      'This is step 3 of 4 of the written method: Bring down the 7. How many 4s go into 37?',
    );
  });

  it('passes the gate when it points at the step without working it', () => {
    expect(verdict('Bring the 7 down next to the 3. How many fours fit into 37?', 3).verdict).toBe(
      'pass',
    );
  });

  it('fails the gate when it gives the step answer or the whole answer', () => {
    const stepAnswer = verdict('Four fits into 37 nine times, so write 9.', 3);
    expect(stepAnswer).toMatchObject({ verdict: 'fail' });
    const whole = verdict('Keep going and you will get 39 r 1.', 3);
    expect(whole).toMatchObject({ verdict: 'fail' });
  });

  it('gives nothing to a hint that is not a step', () => {
    const turn = stepTurn(1);
    expect(
      stepHintInputs({ ...turn, plan: { ...turn.plan, approach: 'single-nudge' } }).lines,
    ).toEqual([]);
  });
});
