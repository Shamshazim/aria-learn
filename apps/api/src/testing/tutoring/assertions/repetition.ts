import type { InvariantFinding } from '@/testing/tutoring/assertions/invariant.types';
import type { TutoringTranscript } from '@/testing/tutoring/transcript';

/**
 * Aria never says the same sentence twice in a row (P2H-01).
 *
 * This is the invariant a child notices first. Repeating a sentence is what a machine does
 * when it has run out of ideas, and it is exactly what the old silence handling did: the same
 * "Take your time" every twelve seconds until the child gave up. Comparison ignores case and
 * whitespace, because "Try again." and "try again" are the same sentence to a listener.
 */
export function checkRepeatedSentences(
  transcript: TutoringTranscript,
): readonly InvariantFinding[] {
  const findings: InvariantFinding[] = [];
  let previous: string | null = null;
  let previousEventId = '';
  for (const turn of transcript.turns) {
    for (const move of turn.moves) {
      const spoken = normalise(move.speech?.text ?? '');
      if (spoken === '') continue;
      if (spoken === previous) {
        findings.push({
          code: 'SENTENCE_REPEATED',
          scenarioId: transcript.scenarioId,
          eventId: turn.event.id,
          message: `Aria repeated her previous sentence in ${move.kind} (also said at ${previousEventId}).`,
        });
      }
      previous = spoken;
      previousEventId = turn.event.id;
    }
  }
  return findings;
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/gu, ' ').trim();
}
