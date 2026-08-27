import { describe, expect, it, vi } from 'vitest';

import { createQualityGate } from '@/quality';
import {
  STRUCTURAL_CASES,
  VALID_ARITHMETIC_ITEM,
} from '@/quality/__fixtures__/structural-cases.data';

const safe = vi.fn(() => ({ safe: true, categories: [] }));

describe('quality gate', () => {
  it.each(STRUCTURAL_CASES)('rejects $name with $code', ({ input, code }) => {
    const verdict = createQualityGate(safe)(input);

    expect(verdict.verdict).toBe('fail');
    if (verdict.verdict === 'fail') {
      expect(verdict.reasons).toContainEqual(
        expect.objectContaining({ check: 'structural', code }),
      );
    }
  });

  it('runs every check in order and always calls safety for a passing item', () => {
    safe.mockClear();
    const verdict = createQualityGate(safe)(VALID_ARITHMETIC_ITEM);

    expect(verdict.verdict).toBe('pass');
    expect(verdict.checks.map((check) => check.check)).toEqual([
      'structural',
      'correctness',
      'claims',
      'level',
      'safety',
    ]);
    expect(safe).toHaveBeenCalledTimes(1);
  });

  it('rejects a wrong arithmetic key by code', () => {
    const wrongKey = {
      ...VALID_ARITHMETIC_ITEM,
      answerKey: 'a',
      options: VALID_ARITHMETIC_ITEM.options.map((option) => ({
        ...option,
        isCorrect: option.id === 'a',
      })),
    };

    expect(createQualityGate(safe)(wrongKey)).toMatchObject({
      verdict: 'fail',
      reasons: [{ check: 'correctness', code: 'arithmetic_incorrect' }],
    });
  });

  it('rejects unsupported facts even if another model could agree', () => {
    const verdict = createQualityGate(safe)({
      id: 'unsupported',
      kind: 'text',
      band: 'senior',
      childText: 'A claim needs evidence.',
      factual: true,
      grounding: 'unsupported',
    });

    expect(verdict).toMatchObject({
      verdict: 'fail',
      reasons: [{ check: 'correctness', code: 'unsupported_fact' }],
    });
  });

  it('rejects senior vocabulary and long sentences for the early band', () => {
    const verdict = createQualityGate(safe)({
      id: 'too-hard',
      kind: 'text',
      band: 'early',
      childText:
        'Interpret the sophisticated relationship because the argument needs evidence and support and contrast and reason.',
      factual: false,
      grounding: 'reviewed-bank',
    });

    expect(verdict.verdict).toBe('fail');
    if (verdict.verdict === 'fail') {
      expect(verdict.reasons.map((reason) => reason.code)).toEqual([
        'sentence_too_long',
        'readability',
      ]);
    }
  });
});
