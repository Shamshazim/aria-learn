import { describe, expect, it } from 'vitest';

import { evaluatePhase2Exit } from './phase2-exit';

describe('Phase 2 exit', () => {
  it('cannot pass when external child, human-review, golden-set, or privacy evidence is absent', () => {
    const report = evaluatePhase2Exit({
      independentEarlyReaderSessionPassed: false,
      coreSetFalseTeachingCount: null,
      lowConfidenceDurableUpdateCount: null,
      spokenTeachingHumanReviewPassed: false,
      voiceGoldenSetPassed: false,
      privacyCounselSignoffRecorded: false,
    });

    expect(report.passed).toBe(false);
    expect(report.blockers).toHaveLength(6);
  });

  it('passes only when every blocking criterion has direct evidence', () => {
    expect(
      evaluatePhase2Exit({
        independentEarlyReaderSessionPassed: true,
        coreSetFalseTeachingCount: 0,
        lowConfidenceDurableUpdateCount: 0,
        spokenTeachingHumanReviewPassed: true,
        voiceGoldenSetPassed: true,
        privacyCounselSignoffRecorded: true,
      }),
    ).toEqual({ passed: true, blockers: [] });
  });
});
