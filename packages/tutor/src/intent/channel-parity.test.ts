import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema } from '@aria/shared';

import { UTTERANCE_FIXTURE } from './__fixtures__/utterances.fixture';
import { classifyIntent } from './rules';

/**
 * The same sentence must mean the same thing typed and spoken (P2H-05).
 *
 * The text channel sends `ANSWER`, the voice channel sends `SPEECH_FINAL`, and before this
 * they took different code paths to the same question. Nothing about a child's meaning depends
 * on which device they are on, so both channels read the utterance out of the event and call
 * the same pure function — this test is what stops that quietly diverging again.
 */
function utteranceOf(event: ReturnType<typeof tutorInputEventSchema.parse>): string {
  if (event.kind === 'ANSWER') return event.text ?? '';
  if (event.kind === 'SPEECH_FINAL') return event.text;
  throw new Error(`Not a child utterance: ${event.kind}`);
}

function typed(text: string) {
  return tutorInputEventSchema.parse({
    id: 'event-typed',
    at: '2026-08-25T10:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    kind: 'ANSWER',
    respondsTo: 'ask-1',
    text,
  });
}

function spoken(text: string, confidence = 0.95) {
  return tutorInputEventSchema.parse({
    id: 'event-spoken',
    at: '2026-08-25T10:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    kind: 'SPEECH_FINAL',
    text,
    confidence,
  });
}

describe('voice and text agree', () => {
  it.each(UTTERANCE_FIXTURE.filter((entry) => entry.text.trim() !== ''))(
    'reads "$text" the same way on both channels',
    (entry) => {
      const hints = { answerKey: entry.answerKey };

      expect(classifyIntent(utteranceOf(spoken(entry.text)), hints)).toEqual(
        classifyIntent(utteranceOf(typed(entry.text)), hints),
      );
    },
  );

  it('differs only where the channel genuinely knows something extra', () => {
    const hints = { answerKey: '7' };

    // A confident transcript is read exactly as typing it would be.
    expect(classifyIntent('seven', { ...hints, speechConfidence: 0.95 }).intent).toBe(
      classifyIntent('seven', hints).intent,
    );
    // A poor one is not, because the text channel cannot mishear.
    expect(classifyIntent('seven', { ...hints, speechConfidence: 0.3 }).intent).toBe('UNCLEAR');
  });
});
