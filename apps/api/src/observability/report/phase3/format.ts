import type { Phase3ExitReport } from '@aria/tutor';

const MARK = {
  passed: 'PASS',
  failed: 'FAIL',
  missing: 'MISSING',
  insufficient_sample: 'SAMPLE',
} as const;

/** The report as a reviewer reads it: one line per criterion, worst news first. */
export function formatPhase3Report(report: Phase3ExitReport): string {
  const lines = report.results.map(
    (result) => `${MARK[result.status].padEnd(8)} ${result.title}: ${result.detail}`,
  );
  return [
    `Phase 3 exit: ${report.passed ? 'PASSED' : 'NOT PASSED'} (${report.evaluatedAt})`,
    ...lines,
  ].join('\n');
}
