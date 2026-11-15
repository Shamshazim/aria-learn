import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { TutorMove } from '@aria/shared';

import { checkTutoringInvariants } from '@/testing/tutoring/assertions/invariants';
import { createHarnessTutor } from '@/testing/tutoring/harness-adapter';
import { replayScenario } from '@/testing/tutoring/replay';
import { loadTutoringScenarios } from '@/testing/tutoring/scenario';
import type { TutoringTranscript } from '@/testing/tutoring/transcript';

const PHASE3 = fileURLToPath(
  new URL('../../../../../../dev-docs/golden/tutoring/scenarios/phase3/', import.meta.url),
);

async function run(id: string): Promise<TutoringTranscript> {
  const scenario = (await loadTutoringScenarios(PHASE3)).find((item) => item.id === id);
  if (scenario === undefined) throw new Error(`${id} is missing`);
  return replayScenario(scenario, createHarnessTutor(scenario));
}

/** The transcript with one move's speech replaced, to show a check catches what it exists for. */
function say(transcript: TutoringTranscript, moveId: string, text: string): TutoringTranscript {
  return {
    ...transcript,
    turns: transcript.turns.map((turn) => ({
      ...turn,
      moves: turn.moves.map((move): TutorMove =>
        move.id === moveId && 'speech' in move ? { ...move, speech: { text } } : move,
      ),
    })),
  };
}

const codes = (transcript: TutoringTranscript) =>
  checkTutoringInvariants(transcript).findings.map((finding) => finding.code);

describe('the Phase 3 scenarios (P3-08)', () => {
  it('has the six scenarios the ticket names, and every one passes every invariant', async () => {
    const scenarios = await loadTutoringScenarios(PHASE3);
    expect(scenarios.map((scenario) => scenario.id).sort()).toEqual([
      'backward-move',
      'brief-drift',
      'correction-next-session',
      'invented-fact-trap',
      'opens-knowing-child',
      'tired-adapts-no-label',
    ]);
    for (const scenario of scenarios) {
      const transcript = await replayScenario(scenario, createHarnessTutor(scenario));
      expect(checkTutoringInvariants(transcript).findings, scenario.id).toEqual([]);
    }
  });

  it('catches a name Aria was never given evidence for', async () => {
    const trap = await run('invented-fact-trap');
    expect(codes(say(trap, 'mov_p3_trap_welcome', 'Hello again. How is Maya doing?'))).toContain(
      'UNSUPPORTED_CLAIM',
    );
  });

  it('catches a corrected fact said again in the next session', async () => {
    const correction = await run('correction-next-session');
    expect(
      codes(say(correction, 'mov_p3_corr_welcome2', 'Hello again. Still into dinosaurs?')),
    ).toContain('CORRECTED_FACT_ASSERTED');
  });

  it('catches a feeling said as a fact, and a turn that does not adapt', async () => {
    const tired = await run('tired-adapts-no-label');
    expect(
      codes(say(tired, 'mov_p3_tired_small', 'You are tired, so here is one more.')),
    ).toContain('STATE_LABEL_ASSERTED');
    const unchanged = {
      ...tired,
      turns: tired.turns.map((turn) => ({
        ...turn,
        evidence: { ...turn.evidence, approachId: 'check-in' },
      })),
    };
    expect(codes(unchanged)).toContain('ADAPTATION_MISSING');
  });

  it('catches a recap that asserts the drifted, unevidenced fact', async () => {
    const brief = await run('brief-drift');
    const drifted = {
      ...brief,
      turns: brief.turns.map((turn, index) =>
        index === 1
          ? { ...turn, evidence: { ...turn.evidence, assertedFactIds: ['fact_natural_at_maths'] } }
          : turn,
      ),
    };
    expect(codes(drifted)).toContain('FACT_WITHOUT_EVIDENCE');
  });

  it('runs the real policy on the backward move: hint, another way, then a step back', async () => {
    const backward = await run('backward-move');
    expect(backward.turns.map((turn) => turn.evidence.plannedMove)).toEqual([
      'HINT',
      'RETEACH',
      'SWITCH',
    ]);
  });
});
