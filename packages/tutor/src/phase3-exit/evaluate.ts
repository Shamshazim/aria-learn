import * as automated from './automated';
import * as human from './human';

import type { Finding } from './automated';
import type {
  CriterionId,
  CriterionResult,
  CriterionStatus,
  Phase3ExitEvidence,
  Phase3ExitReport,
} from './types';

/**
 * The Phase 3 exit gate (P3-08). Each criterion joins its automated and its human evidence,
 * and the weaker of the two decides: missing or too small a sample beats a pass, a failure
 * beats everything. The phase passes only when every criterion has passed.
 */
export function evaluatePhase3Exit(evidence: Phase3ExitEvidence): Phase3ExitReport {
  const { automated: auto, human: people, evaluatedAt: at } = evidence;
  const results: CriterionResult[] = [
    result('opens-knowing-child', 'Opens knowing the child', [
      automated.welcomes(auto),
      human.welcomeConfirmations(people, at),
    ]),
    result('no-invented-facts', 'No invented facts', [
      automated.inventedClaims(auto),
      human.briefReviews(people, at),
    ]),
    result('claims-link-to-evidence', 'Every durable claim links to evidence', [
      automated.evidenceLinks(auto),
    ]),
    result('correction-next-session', 'Parent correction reflected next session', [
      automated.correction(auto),
      human.corrections(people, at),
    ]),
    result('adapts-without-label', 'Adapts to tired or frustrated without a label', [
      automated.adaptation(auto),
      human.checkInRatings(people, at),
    ]),
    result('rebuild-drift', 'Memory rebuild drift', [automated.rebuild(auto)]),
    result('bar-approach-changes', 'Two wrong answers without a change of approach: 0', [
      automated.zeroBar(
        auto.approachUnchangedAfterTwoWrong,
        'Unchanged approaches after two wrong answers',
      ),
    ]),
    result('bar-affect-not-fact', 'Low-confidence affect stated as fact: 0', [
      automated.zeroBar(auto.lowConfidenceAffectAsFact, 'Low-confidence affect stated as fact'),
    ]),
    result('human-protocol', 'Human observation protocol', [human.protocolChildren(people, at)]),
  ];
  return { passed: results.every((item) => item.status === 'passed'), evaluatedAt: at, results };
}

/** Worst first: a failure outranks a gap, a gap outranks a small sample, which outranks a pass. */
const SEVERITY: Readonly<Record<CriterionStatus, number>> = {
  failed: 3,
  missing: 2,
  insufficient_sample: 1,
  passed: 0,
};

function result(id: CriterionId, title: string, findings: readonly Finding[]): CriterionResult {
  const worst = [...findings].sort(
    (left, right) => SEVERITY[right.status] - SEVERITY[left.status],
  )[0];
  const status = worst?.status ?? 'missing';
  // Every finding that is not a pass, so a human gap never hides an automated one behind it.
  const open = findings.filter((finding) => finding.status !== 'passed');
  const detail = (open.length === 0 ? findings : open).map((finding) => finding.detail).join(' ');
  return { id, title, status, detail };
}
