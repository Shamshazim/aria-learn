import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, speechFinalEventSchema } from '@aria/shared';

import { createQualityGate } from '@/quality';
import { detectCrisis } from '@/safety/crisis/detect';
import { escalate } from '@/safety/crisis/escalate';
import { ESCALATION_MATRIX, UNCERTAIN_HIGH_RISK_RESPONSE } from '@/safety/crisis/matrix';
import type { CrisisCategory } from '@/safety/crisis/matrix';

const CATEGORIES: readonly CrisisCategory[] = [
  'self_harm',
  'immediate_danger',
  'household_abuse',
  'general_distress',
];

describe('crisis detection and fixed responses', () => {
  it.each([
    ['I want to hurt myself', 'self_harm'],
    ['I am in danger', 'immediate_danger'],
    ['My dad hit me', 'household_abuse'],
    ['I feel hopeless', 'general_distress'],
  ] as const)('routes %s without a model', (text, category) => {
    expect(detectCrisis({ text })).toMatchObject({ kind: 'crisis', category });
  });

  it('treats a low-confidence high-risk alternative as uncertain', () => {
    const event = speechFinalEventSchema.parse({
      id: 'event-1',
      at: '2026-08-24T20:00:00.000Z',
      protocolVersion: PROTOCOL_VERSION,
      kind: 'SPEECH_FINAL',
      text: 'I am fine',
      alternatives: [{ text: 'I want to hurt myself', confidence: 0.4 }],
    });
    expect(
      detectCrisis({
        text: event.text,
        ...(event.alternatives === undefined ? {} : { alternatives: event.alternatives }),
      }),
    ).toMatchObject({ kind: 'uncertain', category: 'self_harm' });
  });

  it('does not escalate a low-confidence primary transcript as confirmed', () => {
    expect(detectCrisis({ text: 'I want to hurt myself', confidence: 0.4 })).toMatchObject({
      kind: 'uncertain',
      category: 'self_harm',
    });
  });

  it('keeps every reviewed response inside the child-output gate', () => {
    const gate = createQualityGate(() => ({ safe: true, categories: [] }));
    const responses = [
      ...Object.values(ESCALATION_MATRIX).map((rule) => rule.response),
      UNCERTAIN_HIGH_RISK_RESPONSE,
    ];
    for (const childText of responses) {
      expect(
        gate({
          id: 'fixed',
          kind: 'text',
          band: 'early',
          childText,
          factual: false,
          grounding: 'reviewed-bank',
        }).verdict,
      ).toBe('pass');
    }
  });

  it.each(CATEGORIES)('routes %s only through its matrix contact', async (category) => {
    const rule = ESCALATION_MATRIX[category];
    const notify = vi.fn(() => Promise.resolve());
    await expect(
      escalate({ notify }, { studentId: 'student-1', sessionId: 'session-1', category }),
    ).resolves.toBe(rule.route);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ route: rule.route }));
  });
});
