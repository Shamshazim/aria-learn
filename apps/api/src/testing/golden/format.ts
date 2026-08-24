import type { GoldenReport } from '@/testing/golden/report';

export function formatGoldenReport(report: GoldenReport): string {
  const lines = [
    `Content golden set — ${report.endpointName}`,
    `Prompt: ${report.promptName}@${report.promptVersion}`,
    `Items: ${String(report.itemCount)} (human approved ${String(report.humanReview.approved)}, pending ${String(report.humanReview.pending)})`,
    `Coverage: arithmetic ${String(report.coverage.arithmetic)}, reading ${String(report.coverage.reading)}, writing ${String(report.coverage.writing)}`,
    `Latency: mean ${report.meanLatencyMs.toFixed(1)}ms, p95 ${report.p95LatencyMs.toFixed(1)}ms`,
    `Cost: $${report.totalCostUsd.toFixed(6)}`,
  ];
  for (const [name, check] of Object.entries(report.checks)) {
    const rate = check.rate === null ? 'n/a' : `${(check.rate * 100).toFixed(2)}%`;
    const failures =
      check.failingItemIds.length === 0 ? '' : ` failures: ${check.failingItemIds.join(', ')}`;
    lines.push(
      `${name}: ${rate} (${String(check.passed)}/${String(check.eligible)}, bar ${(check.bar * 100).toFixed(0)}%)${failures}`,
    );
  }
  lines.push(`Release result: ${report.passed ? 'PASS' : 'FAIL'}`);
  return `${lines.join('\n')}\n`;
}
