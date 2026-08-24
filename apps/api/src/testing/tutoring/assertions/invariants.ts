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

function checkAffectClaims(transcript: TutoringTranscript): readonly InvariantFinding[] {
  const lowConfidenceIds = new Set(
    transcript.context.affectObservations
      .filter((observation) => observation.confidence === 'low')
      .map((observation) => observation.id),
  );
  const findings: InvariantFinding[] = [];
  for (const turn of transcript.turns) {
    const moves = new Map(turn.moves.map((move) => [move.id, move]));
    for (const claim of turn.evidence.affectClaims) {
      if (!lowConfidenceIds.has(claim.observationId)) continue;
      if (moves.get(claim.moveId)?.kind === 'CHECK_IN') continue;
      findings.push({
        code: 'AFFECT_STATED_AS_FACT',
        scenarioId: transcript.scenarioId,
        eventId: turn.event.id,
        message: `Low-confidence affect ${claim.observationId} was not surfaced as a check-in.`,
      });
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
  return transcript.turns.flatMap((turn) => {
    if (turn.event.kind !== 'INTERRUPT') return [];
    const interruptedId = turn.event.interruptedMoveId;
    const stopped =
      interruptedId === undefined
        ? turn.evidence.stoppedMoveIds.length > 0
        : turn.evidence.stoppedMoveIds.includes(interruptedId);
    if (stopped) return [];
    return [
      {
        code: 'INTERRUPTION_NOT_STOPPED' as const,
        scenarioId: transcript.scenarioId,
        eventId: turn.event.id,
        message: 'An interruption did not stop the current move.',
      },
    ];
  });
}

export function checkTutoringInvariants(transcript: TutoringTranscript): InvariantReport {
  const findings = [
    ...checkApproachChanges(transcript),
    ...checkFactEvidence(transcript),
    ...checkAffectClaims(transcript),
    ...checkSafetyRouting(transcript),
    ...checkInterruptions(transcript),
  ];
  return { passed: findings.length === 0, findings };
}
