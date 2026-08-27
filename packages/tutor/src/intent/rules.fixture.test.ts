import { describe, expect, it } from 'vitest';

import { UTTERANCE_FIXTURE } from './__fixtures__/utterances.fixture';
import { classifyIntent } from './rules';

const RULES_AGREEMENT_BAR = 0.9;

describe('intent rules against hand-labelled utterances', () => {
  it('has sixty utterances covering every intent', () => {
    expect(UTTERANCE_FIXTURE).toHaveLength(60);
    for (const intent of [
      'ANSWER',
      'QUESTION',
      'CONFUSED',
      'CHAT',
      'STOP_REQUEST',
      'PERSONAL_INFO',
      'UNCLEAR',
    ]) {
      expect(
        UTTERANCE_FIXTURE.some((entry) => entry.expected === intent),
        `no fixture for ${intent}`,
      ).toBe(true);
    }
  });

  it('agrees with a human on at least 90% of them', () => {
    const disagreements = UTTERANCE_FIXTURE.filter(
      (entry) =>
        classifyIntent(entry.text, { answerKey: entry.answerKey }).intent !== entry.expected,
    ).map(
      (entry) =>
        `"${entry.text}" → ${classifyIntent(entry.text, { answerKey: entry.answerKey }).intent}, expected ${entry.expected}`,
    );
    const agreement = (UTTERANCE_FIXTURE.length - disagreements.length) / UTTERANCE_FIXTURE.length;

    expect(agreement, `disagreements:\n${disagreements.join('\n')}`).toBeGreaterThanOrEqual(
      RULES_AGREEMENT_BAR,
    );
  });

  it('never mistakes personal information for an answer', () => {
    for (const entry of UTTERANCE_FIXTURE.filter((item) => item.expected === 'PERSONAL_INFO')) {
      expect(classifyIntent(entry.text, { answerKey: entry.answerKey }).intent, entry.text).toBe(
        'PERSONAL_INFO',
      );
    }
  });

  it('never mistakes a request to stop for anything else', () => {
    for (const entry of UTTERANCE_FIXTURE.filter((item) => item.expected === 'STOP_REQUEST')) {
      expect(classifyIntent(entry.text, { answerKey: entry.answerKey }).intent, entry.text).toBe(
        'STOP_REQUEST',
      );
    }
  });

  it('treats a poor transcript as unclear whatever the words say', () => {
    expect(classifyIntent('seven', { answerKey: '7', speechConfidence: 0.4 })).toMatchObject({
      intent: 'UNCLEAR',
      matchedRule: 'low-speech-confidence',
    });
  });
});
