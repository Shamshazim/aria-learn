import { procedureSteps } from '@/quality/arithmetic';
import type { InvariantFinding } from '@/testing/tutoring/assertions/invariant.types';
import type { TutoringTranscript } from '@/testing/tutoring/transcript';

/**
 * P3-07: a procedure item never resolves to a REVEAL of the final answer before every step has
 * had a turn. Checked on what the policy planned and on what was emitted, so neither a policy
 * change nor a scripted move can slip a reveal in early.
 */
export function checkProcedureReveals(transcript: TutoringTranscript): readonly InvariantFinding[] {
  const problem = transcript.context.item?.arithmeticProblem;
  const steps = problem === undefined ? 0 : procedureSteps(problem).length;
  if (steps === 0) return [];
  const outcomes = new Map(
    transcript.context.answerOutcomes.map((item) => [item.eventId, item.outcome]),
  );
  const findings: InvariantFinding[] = [];
  let tried = 0;
  for (const turn of transcript.turns) {
    const revealed =
      turn.evidence.plannedMove === 'REVEAL' || turn.moves.some((move) => move.kind === 'REVEAL');
    if (revealed && tried < steps) {
      findings.push({
        code: 'REVEAL_BEFORE_STEPS',
        scenarioId: transcript.scenarioId,
        eventId: turn.event.id,
        message: `The answer was revealed after ${String(tried)} of ${String(steps)} steps.`,
      });
    }
    const outcome = outcomes.get(turn.event.id);
    if (outcome === 'correct') tried = 0;
    else if (outcome === 'wrong') tried += 1;
  }
  return findings;
}
