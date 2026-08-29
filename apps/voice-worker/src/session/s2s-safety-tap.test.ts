import { describe, expect, it } from 'vitest';

import { createSafetyTap } from '@/session/s2s-safety-tap';

describe('the speech-to-speech safety tap', () => {
  it('lets the planned sentences through however the vendor chunks them', () => {
    const tap = createSafetyTap();
    tap.allow(['Count the shapes.', 'How many do you see?']);

    expect(tap.observe('Count the ')).toEqual({ kind: 'on_plan' });
    expect(tap.observe('sha')).toEqual({ kind: 'on_plan' });
    expect(tap.observe('pes. How many')).toEqual({ kind: 'on_plan' });
    expect(tap.observe(' do you see?')).toEqual({ kind: 'on_plan' });
    expect(tap.offPlanCount()).toBe(0);
  });

  it('ignores case and punctuation, which a transcript does not preserve', () => {
    const tap = createSafetyTap();
    tap.allow(["Well done, Maya! That's three."]);

    expect(tap.observe('well done maya thats three')).toEqual({ kind: 'on_plan' });
  });

  /** The ticket's edge case: the vendor drops the tool call and answers freely. */
  it('cuts a sentence the planner never returned and counts the words that escaped', () => {
    const tap = createSafetyTap();
    tap.allow(['Count the shapes.']);

    expect(tap.observe('Sure! The answer ')).toEqual({
      kind: 'off_plan',
      heard: 'Sure! The answer',
      escapedWords: 3,
    });
    expect(tap.offPlanCount()).toBe(1);
    expect(tap.escapedWords()).toBe(3);
  });

  it('allows nothing before a plan exists, so speaking first is off-plan', () => {
    const tap = createSafetyTap();

    expect(tap.observe('Hello there!').kind).toBe('off_plan');
  });

  it('holds an unfinished word until the next chunk shows where it ended', () => {
    const tap = createSafetyTap();
    tap.allow(['Count the shapes.']);

    expect(tap.observe('Count the shap')).toEqual({ kind: 'on_plan' });
    expect(tap.observe('ing centre')).toEqual({
      kind: 'off_plan',
      heard: 'Count the shaping centre',
      escapedWords: 4,
    });
  });

  it('reports once per cut and starts clean on the next plan', () => {
    const tap = createSafetyTap();
    tap.allow(['Count the shapes.']);
    tap.observe('Nope. ');
    expect(tap.observe('More words.')).toEqual({ kind: 'on_plan' });

    tap.allow(['Try again.']);
    expect(tap.observe('Try again.')).toEqual({ kind: 'on_plan' });
    expect(tap.offPlanCount()).toBe(1);
  });

  it('forgets the last generation on reset but keeps the plan', () => {
    const tap = createSafetyTap();
    tap.allow(['Count the shapes.']);
    tap.observe('Count the shapes.');
    tap.reset();

    expect(tap.observe('Count the shapes.')).toEqual({ kind: 'on_plan' });
  });
});
