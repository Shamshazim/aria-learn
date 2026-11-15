import type { AutomatedEvidence } from '@aria/tutor';

import { checkTutoringInvariants } from '@/testing/tutoring/assertions/invariants';
import { createHarnessTutor } from '@/testing/tutoring/harness-adapter';
import { replayScenario } from '@/testing/tutoring/replay';
import { loadTutoringScenarios } from '@/testing/tutoring/scenario';

export type GoldenEvidence = Pick<
  AutomatedEvidence,
  | 'inventedClaims'
  | 'correctionScenarioPassed'
  | 'tiredScenario'
  | 'approachUnchangedAfterTwoWrong'
  | 'lowConfidenceAffectAsFact'
>;

export const NO_GOLDEN_EVIDENCE: GoldenEvidence = {
  inventedClaims: null,
  correctionScenarioPassed: null,
  tiredScenario: null,
  approachUnchangedAfterTwoWrong: null,
  lowConfidenceAffectAsFact: null,
};

const TRAPS = ['invented-fact-trap', 'brief-drift'] as const;

/**
 * Runs every golden tutoring scenario through the real harness and reads the Phase 3 answers
 * off the machine invariants (P3-08). A scenario the ticket needs and the directory lacks is
 * `null` evidence, so the gate says missing rather than passing on a scenario nobody ran.
 */
export async function collectGoldenEvidence(directory: string): Promise<GoldenEvidence> {
  const scenarios = await loadTutoringScenarios(directory);
  const reports = await Promise.all(
    scenarios.map(async (scenario) => {
      const transcript = await replayScenario(scenario, createHarnessTutor(scenario));
      return { id: scenario.id, findings: checkTutoringInvariants(transcript).findings };
    }),
  );
  const byId = new Map(reports.map((report) => [report.id, report.findings]));
  const count = (code: string, ids?: readonly string[]) =>
    reports
      .filter((report) => ids === undefined || ids.includes(report.id))
      .flatMap((report) => report.findings)
      .filter((finding) => finding.code === code).length;
  const traps = TRAPS.filter((id) => byId.has(id));
  const correction = byId.get('correction-next-session');
  const tired = byId.get('tired-adapts-no-label');
  return {
    inventedClaims:
      traps.length === 0
        ? null
        : {
            scenarios: traps.length,
            unsupported: count('UNSUPPORTED_CLAIM', traps) + count('FACT_WITHOUT_EVIDENCE', traps),
          },
    correctionScenarioPassed: correction === undefined ? null : correction.length === 0,
    tiredScenario:
      tired === undefined
        ? null
        : {
            adapted: !tired.some((finding) => finding.code === 'ADAPTATION_MISSING'),
            stateLabelsAsserted: tired.filter((finding) => finding.code === 'STATE_LABEL_ASSERTED')
              .length,
          },
    approachUnchangedAfterTwoWrong: count('APPROACH_NOT_CHANGED'),
    lowConfidenceAffectAsFact: count('AFFECT_STATED_AS_FACT') + count('STATE_LABEL_ASSERTED'),
  };
}
