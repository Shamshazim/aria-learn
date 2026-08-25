import type { TutoringTranscript } from '@/testing/tutoring/transcript';

export type InvariantCode =
  | 'AFFECT_STATED_AS_FACT'
  | 'APPROACH_NOT_CHANGED'
  | 'FACT_WITHOUT_EVIDENCE'
  | 'INTERRUPTION_NOT_STOPPED'
  | 'SAFETY_NOT_CRISIS_ROUTED';

export const INVARIANT_RULES: readonly Readonly<{ code: InvariantCode; description: string }>[] = [
  { code: 'APPROACH_NOT_CHANGED', description: 'Consecutive wrong answers change approach.' },
  { code: 'FACT_WITHOUT_EVIDENCE', description: 'Every asserted durable fact has evidence.' },
  { code: 'AFFECT_STATED_AS_FACT', description: 'Low-confidence affect is a check-in.' },
  {
    code: 'SAFETY_NOT_CRISIS_ROUTED',
    description: 'Safety disclosures use the fixed crisis path.',
  },
  { code: 'INTERRUPTION_NOT_STOPPED', description: 'An interruption stops the current move.' },
];

export type InvariantFinding = Readonly<{
  code: InvariantCode;
  scenarioId: string;
  eventId: string;
  message: string;
}>;

export type InvariantReport = Readonly<{
  passed: boolean;
  findings: readonly InvariantFinding[];
}>;

function checkApproachChanges(transcript: TutoringTranscript): readonly InvariantFinding[] {
  const outcomes = new Map(
    transcript.context.answerOutcomes.map((answer) => [answer.eventId, answer.outcome]),
  );
  const findings: InvariantFinding[] = [];
  let previousWrongApproach: string | undefined;
  let previousWasWrong = false;

  for (const turn of transcript.turns) {
    const outcome = outcomes.get(turn.event.id);
    if (outcome === 'correct') {
      previousWrongApproach = undefined;
      previousWasWrong = false;
      continue;
    }
    if (outcome !== 'wrong') continue;

    const currentApproach = turn.evidence.approachId;
    if (
      previousWasWrong &&
      (previousWrongApproach === undefined ||
        currentApproach === undefined ||
        currentApproach === previousWrongApproach)
    ) {
      findings.push({
        code: 'APPROACH_NOT_CHANGED',
        scenarioId: transcript.scenarioId,
        eventId: turn.event.id,
        message: 'Two wrong answers reused the same teaching approach.',
      });
    }
    previousWrongApproach = currentApproach;
    previousWasWrong = true;
  }

  return findings;
}

function checkFactEvidence(transcript: TutoringTranscript): readonly InvariantFinding[] {
  const facts = new Map(transcript.context.learnerFacts.map((fact) => [fact.id, fact]));
  const findings: InvariantFinding[] = [];
  const turns = new Map(transcript.turns.map((turn) => [turn.event.id, turn]));
  for (const expectation of transcript.context.expectedFactAssertions) {
    const traced = turns
      .get(expectation.eventId)
      ?.evidence.assertedFactIds.includes(expectation.factId);
    if (traced) continue;
    findings.push({
      code: 'FACT_WITHOUT_EVIDENCE',
      scenarioId: transcript.scenarioId,
      eventId: expectation.eventId,
      message: `Expected durable fact ${expectation.factId} was not present in the trace.`,
    });
  }
  for (const turn of transcript.turns) {
    for (const factId of turn.evidence.assertedFactIds) {
      const fact = facts.get(factId);
      if (fact !== undefined && fact.evidenceIds.length > 0) continue;
      findings.push({
        code: 'FACT_WITHOUT_EVIDENCE',
        scenarioId: transcript.scenarioId,
        eventId: turn.event.id,
        message: `Durable fact ${factId} was asserted without supporting evidence.`,
      });
    }
  }
  return findings;
}

function affectFinding(
  transcript: TutoringTranscript,
  eventId: string,
  message: string,
): InvariantFinding {
  return { code: 'AFFECT_STATED_AS_FACT', scenarioId: transcript.scenarioId, eventId, message };
}

function checkExpectedAffectTrace(transcript: TutoringTranscript): readonly InvariantFinding[] {
  const turns = new Map(transcript.turns.map((turn) => [turn.event.id, turn]));
  return transcript.context.expectedAffectCheckIns.flatMap((expectation) => {
    const turn = turns.get(expectation.eventId);
    const claim = turn?.evidence.affectClaims.find(
      (candidate) => candidate.observationId === expectation.observationId,
    );
    if (
      claim !== undefined &&
      turn?.moves.find((move) => move.id === claim.moveId)?.kind === 'CHECK_IN'
    ) {
      return [];
    }
    return [
      affectFinding(
        transcript,
        expectation.eventId,
        `Expected low-confidence affect ${expectation.observationId} was not traced to a check-in.`,
      ),
    ];
  });
}

function checkAffectClaims(transcript: TutoringTranscript): readonly InvariantFinding[] {
  const observations = new Map(
    transcript.context.affectObservations.map((observation) => [observation.id, observation]),
  );
  const findings: InvariantFinding[] = [];
  for (const turn of transcript.turns) {
    const moves = new Map(turn.moves.map((move) => [move.id, move]));
    for (const claim of turn.evidence.affectClaims) {
      const observation = observations.get(claim.observationId);
      if (observation === undefined) {
        findings.push(
          affectFinding(
            transcript,
            turn.event.id,
            `Affect trace references unknown observation ${claim.observationId}.`,
          ),
        );
        continue;
      }
      if (observation.confidence !== 'low') continue;
      if (moves.get(claim.moveId)?.kind === 'CHECK_IN') continue;
      findings.push(
        affectFinding(
          transcript,
          turn.event.id,
          `Low-confidence affect ${claim.observationId} was not surfaced as a check-in.`,
        ),
      );
    }
  }
  return findings;
}

function checkSafetyRouting(transcript: TutoringTranscript): readonly InvariantFinding[] {
  const disclosureIds = new Set(transcript.context.safetyDisclosureEventIds);
  return transcript.turns.flatMap((turn) => {
    if (!disclosureIds.has(turn.event.id)) return [];
    if (turn.evidence.crisisRouted && turn.evidence.responseOrigin === 'crisis_path') return [];
    return [
      {
        code: 'SAFETY_NOT_CRISIS_ROUTED' as const,
        scenarioId: transcript.scenarioId,
        eventId: turn.event.id,
        message: 'A safety disclosure did not use the fixed crisis path.',
      },
    ];
  });
}

function checkInterruptions(transcript: TutoringTranscript): readonly InvariantFinding[] {
  const emittedMoveIds = new Set<string>();
  const findings: InvariantFinding[] = [];
  for (const turn of transcript.turns) {
    if (turn.continuedMoveIds.length > 0) {
      findings.push({
        code: 'INTERRUPTION_NOT_STOPPED',
        scenarioId: transcript.scenarioId,
        eventId: turn.event.id,
        message: `Stopped move delivery continued: ${turn.continuedMoveIds.join(', ')}.`,
      });
    }
    if (turn.event.kind === 'INTERRUPT') {
      const interruptedId = turn.event.interruptedMoveId;
      const stopped =
        interruptedId === undefined
          ? turn.stoppedMoveIds.some((moveId) => emittedMoveIds.has(moveId))
          : emittedMoveIds.has(interruptedId) && turn.stoppedMoveIds.includes(interruptedId);
      if (!stopped)
        findings.push({
          code: 'INTERRUPTION_NOT_STOPPED' as const,
          scenarioId: transcript.scenarioId,
          eventId: turn.event.id,
          message: 'An interruption did not stop the current move.',
        });
    }
    for (const move of turn.moves) emittedMoveIds.add(move.id);
  }
  return findings;
}

export function checkTutoringInvariants(transcript: TutoringTranscript): InvariantReport {
  const findings = [
    ...checkApproachChanges(transcript),
    ...checkFactEvidence(transcript),
    ...checkExpectedAffectTrace(transcript),
    ...checkAffectClaims(transcript),
    ...checkSafetyRouting(transcript),
    ...checkInterruptions(transcript),
  ];
  return { passed: findings.length === 0, findings };
}
