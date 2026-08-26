import { describe, expect, it } from 'vitest';

import { BANDS, MOVE_KINDS, type Band } from '@aria/shared';

import { createQualityGate } from '@/quality';
import { EMPTY_PRAISE } from '@/quality/checks/claims/claim-vocabulary.data';
import { sentencesOf } from '@/quality/checks/level/readability';
import {
  APPROACH_FALLBACKS,
  MIN_VARIANTS,
  MOVE_FALLBACKS,
  createFallbackPicker,
} from '@/services/content/fallback';
import type { BandVariants } from '@/services/content/fallback';

const gate = createQualityGate(() => ({ safe: true, categories: [] }));
const SETS: readonly (readonly [string, BandVariants])[] = [
  ...Object.entries(MOVE_FALLBACKS),
  ...Object.entries(APPROACH_FALLBACKS),
];
const PARAMETER = /\{(?:name|skillName|answer)\}/gu;

function filled(text: string): string {
  return text
    .replaceAll('{name}', 'Sam')
    .replaceAll('{skillName}', 'counting on')
    .replaceAll('{answer}', '7');
}

describe('the reviewed fallback set', () => {
  it('has a set for every move in the protocol', () => {
    expect(Object.keys(MOVE_FALLBACKS).sort()).toEqual([...MOVE_KINDS].sort());
  });

  it.each(SETS)('offers at least six ways to say %s in every band', (_key, variants) => {
    for (const band of BANDS) expect(variants[band].length).toBeGreaterThanOrEqual(MIN_VARIANTS);
  });

  it.each(SETS)('says %s differently every time within a band', (_key, variants) => {
    for (const band of BANDS) expect(new Set(variants[band]).size).toBe(variants[band].length);
  });

  /**
   * A turn that knows no answer key and no skill name still has to say something. Without a
   * variant that needs neither, the picker would have nothing to choose and the turn would
   * throw — which is how the first version of this reached a 500 in the acceptance run.
   */
  it.each(SETS)('always keeps a way to say %s with nothing filled in', (_key, variants) => {
    for (const band of BANDS) {
      expect(variants[band].filter((text) => !PARAMETER.test(text)).length).toBeGreaterThan(0);
    }
  });

  it.each(SETS)('passes the child-facing gate for %s in every band', (key, variants) => {
    for (const band of BANDS) {
      for (const text of variants[band]) {
        const verdict = gate({
          id: key,
          kind: 'text',
          band,
          childText: filled(text),
          factual: false,
          grounding: 'reviewed-bank',
        });
        const reasons = verdict.verdict === 'fail' ? verdict.reasons : [];
        expect(verdict.verdict, `${key} ${band}: ${text} ${JSON.stringify(reasons)}`).toBe('pass');
      }
    }
  });

  /** P2H-11: a static string knows nothing about the child, so it never rates them. */
  it('never says "good job", "well done" or anything about how clever the child is', () => {
    for (const [, variants] of SETS) {
      for (const band of BANDS) {
        for (const text of variants[band]) {
          const hit = EMPTY_PRAISE.find((phrase) => phrase.test(text.toLowerCase()));
          expect(hit, `${text} matched ${String(hit)}`).toBeUndefined();
        }
      }
    }
  });

  /** §14: an ending never becomes a score, and a static ending cannot be an exception. */
  it('ends a session in three sentences or fewer, with no digits', () => {
    for (const band of BANDS) {
      for (const text of MOVE_FALLBACKS.END[band]) {
        expect(text, text).not.toMatch(/\d/u);
        expect(sentencesOf(text).length, text).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('the fallback picker', () => {
  it('never says the same thing twice in a row for one move', () => {
    const picker = createFallbackPicker({ gate });
    const heard = Array.from({ length: 12 }, () => picker.pick(request('middle')));
    for (const [index, text] of heard.entries()) {
      if (index > 0) expect(text).not.toBe(heard[index - 1]);
    }
  });

  it('walks the whole set before it comes back round', () => {
    const picker = createFallbackPicker({ gate });
    const heard = Array.from({ length: MIN_VARIANTS }, () => picker.pick(request('middle')));
    expect(new Set(heard).size).toBe(MIN_VARIANTS);
  });

  it('keeps one child’s rotation separate from another’s', () => {
    const picker = createFallbackPicker({ gate });
    const first = picker.pick(request('middle'));
    expect(picker.pick({ ...request('middle'), sessionId: 'session-2' })).toBe(first);
  });

  it('fills the answer in when it knows it', () => {
    const picker = createFallbackPicker({ gate });
    const heard = Array.from({ length: MIN_VARIANTS }, () => picker.pick(request('middle')));
    expect(heard.some((text) => text.includes('7'))).toBe(true);
    expect(heard.every((text) => !text.includes('{'))).toBe(true);
  });

  /** A variant that names something we do not know is dropped, not filled with a blank. */
  it('never offers a sentence with a hole in it', () => {
    const picker = createFallbackPicker({ gate });
    const heard = Array.from({ length: MIN_VARIANTS * 2 }, () =>
      picker.pick({ ...request('middle'), parameters: {} }),
    );
    for (const text of heard) expect(text).not.toMatch(/\{|\s{2}|\s\./u);
  });
});

function request(band: Band) {
  return {
    sessionId: 'session-1',
    move: 'PRAISE',
    approach: 'default',
    band,
    parameters: { answer: '7' },
  };
}
