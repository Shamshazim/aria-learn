import type { HumanEvidence, Phase3ExitEvidence } from '@aria/tutor';

import type { GoldenEvidence } from '@/observability/report/phase3/golden.collector';
import type { Phase3DatabaseEvidence } from '@/repositories/phase3-evidence.repository';

/**
 * The evidence file from its parts (P3-08). Each part is `null` when its source could not be
 * reached, and every criterion it feeds then reads as missing — the report never turns an
 * unreachable database into "no problems found".
 */
export function assembleEvidence(
  parts: Readonly<{
    at: Date;
    database: Phase3DatabaseEvidence | null;
    golden: GoldenEvidence;
    arrivalP95Ms: number | null;
    human: HumanEvidence;
  }>,
): Phase3ExitEvidence {
  const { database } = parts;
  return {
    evaluatedAt: parts.at.toISOString(),
    automated: {
      welcomes: database?.welcomes ?? null,
      arrivalVisibleP95Ms: parts.arrivalP95Ms,
      evidenceLinks: database?.evidenceLinks ?? null,
      engagementFactsCreated: database?.engagementFactsCreated ?? null,
      rebuild: database?.rebuild ?? null,
      ...parts.golden,
    },
    human: parts.human,
  };
}
