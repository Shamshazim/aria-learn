import { THRESHOLDS } from './thresholds';

import type { AutomatedEvidence, CriterionStatus } from './types';

/** What one automated half of a criterion found: a status, and why. */
export type Finding = Readonly<{ status: CriterionStatus; detail: string }>;

export const ok = (detail: string): Finding => ({ status: 'passed', detail });
export const failed = (detail: string): Finding => ({ status: 'failed', detail });
export const missing = (detail: string): Finding => ({ status: 'missing', detail });

export function welcomes(evidence: AutomatedEvidence): Finding {
  const { welcomes: seen, arrivalVisibleP95Ms: p95 } = evidence;
  if (seen === null) return missing('No welcomes could be read from the database.');
  if (seen.cohort < THRESHOLDS.goldenCohort) {
    return {
      status: 'insufficient_sample',
      detail: `The golden cohort has ${String(seen.cohort)} students; ${String(THRESHOLDS.goldenCohort)} are needed.`,
    };
  }
  if (seen.evidenceBacked < seen.cohort) {
    return failed(
      `${String(seen.cohort - seen.evidenceBacked)} of ${String(seen.cohort)} welcomes name no evidence-backed fact or episode.`,
    );
  }
  if (p95 === null) return missing('No arrival benchmark result was found.');
  return p95 < THRESHOLDS.arrivalP95Ms
    ? ok(`Every welcome names evidence; p95 visible ${String(p95)} ms.`)
    : failed(
        `p95 visible welcome is ${String(p95)} ms; the bar is under ${String(THRESHOLDS.arrivalP95Ms)} ms.`,
      );
}

export function inventedClaims(evidence: AutomatedEvidence): Finding {
  const found = evidence.inventedClaims;
  if (found === null) return missing('The invented-fact trap scenarios did not run.');
  if (found.scenarios === 0) return missing('No trap scenario was found to run.');
  return found.unsupported === 0
    ? ok(`${String(found.scenarios)} trap scenarios, no unsupported claim.`)
    : failed(`${String(found.unsupported)} claims had no fact or episode behind them.`);
}

export function evidenceLinks(evidence: AutomatedEvidence): Finding {
  const links = evidence.evidenceLinks;
  if (links === null) return missing('Fact and episode evidence could not be counted.');
  if (links.facts + links.episodes === 0) {
    return { status: 'insufficient_sample', detail: 'There are no facts or episodes to check.' };
  }
  const without = links.factsWithoutEvidence + links.episodesWithoutEvidence;
  return without === 0
    ? ok(
        `${String(links.facts)} facts and ${String(links.episodes)} episodes, every one with evidence.`,
      )
    : failed(
        `${String(links.factsWithoutEvidence)} facts and ${String(links.episodesWithoutEvidence)} episodes have no evidence row.`,
      );
}

export function correction(evidence: AutomatedEvidence): Finding {
  if (evidence.correctionScenarioPassed === null)
    return missing('The correction scenario did not run.');
  return evidence.correctionScenarioPassed
    ? ok('The corrected fact was used, and the old one never asserted, next session.')
    : failed('The correction scenario failed.');
}

export function adaptation(evidence: AutomatedEvidence): Finding {
  const { tiredScenario: tired, engagementFactsCreated: engagement } = evidence;
  if (tired === null) return missing('The tired-adapts-no-label scenario did not run.');
  if (engagement === null) return missing('Engagement facts could not be counted in the database.');
  if (!tired.adapted) return failed('Aria did not change what she was doing after the check-in.');
  if (tired.stateLabelsAsserted > 0)
    return failed(`${String(tired.stateLabelsAsserted)} state words were said as fact.`);
  return engagement === 0
    ? ok('Aria adapted, asserted no state, and no engagement fact exists.')
    : failed(`${String(engagement)} engagement facts were made durable.`);
}

export function rebuild(evidence: AutomatedEvidence): Finding {
  const run = evidence.rebuild;
  if (run === null) return missing('No memory rebuild run was found.');
  if (run.students === 0)
    return { status: 'insufficient_sample', detail: 'The rebuild covered no students.' };
  return run.maxDrift <= THRESHOLDS.maxRebuildDrift
    ? ok(`Worst drift ${run.maxDrift.toFixed(3)} across ${String(run.students)} students.`)
    : failed(
        `Worst drift is ${run.maxDrift.toFixed(3)}; the bar is ${String(THRESHOLDS.maxRebuildDrift)}.`,
      );
}

export function zeroBar(value: number | null, what: string): Finding {
  if (value === null) return missing(`${what} could not be counted.`);
  return value === 0 ? ok(`${what}: 0.`) : failed(`${what}: ${String(value)}.`);
}
