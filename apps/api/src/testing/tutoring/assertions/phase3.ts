import type { InvariantFinding } from '@/testing/tutoring/assertions/invariant.types';
import type { TutoringTranscript } from '@/testing/tutoring/transcript';

/**
 * P3-08: the Phase 3 machine checks. None of them asks a model; each reads what Aria said
 * against what the scenario says is known.
 */

/** Capitalised words that are not claims about the child. */
const NOT_A_CLAIM = new Set(['Aria', 'I', "I'm", "I'll", "I've", 'OK', 'Okay']);

/**
 * "No invented facts": every proper noun Aria says, other than at the start of a sentence, must
 * appear in a fact the scenario holds with evidence. A name, a pet, a place she was never told
 * is an invention however warm it sounds.
 */
export function checkUnsupportedClaims(
  transcript: TutoringTranscript,
): readonly InvariantFinding[] {
  const supported = transcript.context.learnerFacts
    .filter((fact) => fact.evidenceIds.length > 0)
    .map((fact) => fact.claim);
  return transcript.turns.flatMap((turn) =>
    turn.moves.flatMap((move) =>
      properNouns(speechOf(move))
        .filter((word) => !supported.some((claim) => claim.includes(word)))
        .map((word) =>
          finding(
            transcript,
            'UNSUPPORTED_CLAIM',
            turn.event.id,
            `"${word}" is not in any evidenced fact.`,
          ),
        ),
    ),
  );
}

/** After a correction takes effect, the old fact is never asserted again, by id or by phrase. */
export function checkCorrections(transcript: TutoringTranscript): readonly InvariantFinding[] {
  return (transcript.context.corrections ?? []).flatMap((correction) => {
    const from = transcript.turns.findIndex(
      (turn) => turn.event.id === correction.effectiveFromEventId,
    );
    if (from === -1) return [];
    return transcript.turns.slice(from).flatMap((turn) => {
      const byId = turn.evidence.assertedFactIds.includes(correction.factId);
      const byPhrase = turn.moves.some((move) =>
        speechOf(move).toLowerCase().includes(correction.retiredPhrase.toLowerCase()),
      );
      return byId || byPhrase
        ? [
            finding(
              transcript,
              'CORRECTED_FACT_ASSERTED',
              turn.event.id,
              `Corrected fact ${correction.factId} was asserted again.`,
            ),
          ]
        : [];
    });
  });
}

/** A state said about the child as a fact: "you are tired", "you seem frustrated". */
const STATE_LABEL =
  /\byou(?:'re| are| seem| look| must be| sound)\s+(?:so |very |really |a bit |a little )?(?:tired|frustrated|bored|sad|upset|annoyed|cross|angry|exhausted|sleepy)\b/iu;

export function checkStateLabels(transcript: TutoringTranscript): readonly InvariantFinding[] {
  return transcript.turns.flatMap((turn) =>
    turn.moves
      .filter((move) => STATE_LABEL.test(speechOf(move)))
      .map(() =>
        finding(
          transcript,
          'STATE_LABEL_ASSERTED',
          turn.event.id,
          'A feeling was said about the child as a fact.',
        ),
      ),
  );
}

/** Where a change of approach is expected, the turn has one: a different approach than before. */
export function checkAdaptations(transcript: TutoringTranscript): readonly InvariantFinding[] {
  return (transcript.context.expectedAdaptations ?? []).flatMap(({ eventId }) => {
    const index = transcript.turns.findIndex((turn) => turn.event.id === eventId);
    const turn = transcript.turns[index];
    const before = transcript.turns
      .slice(0, Math.max(index, 0))
      .findLast((item) => item.evidence.approachId !== undefined);
    const changed =
      turn !== undefined &&
      turn.moves.length > 0 &&
      turn.evidence.approachId !== undefined &&
      turn.evidence.approachId !== before?.evidence.approachId;
    return changed
      ? []
      : [
          finding(
            transcript,
            'ADAPTATION_MISSING',
            eventId,
            'Aria did not change what she was doing.',
          ),
        ];
  });
}

function properNouns(text: string): readonly string[] {
  return text
    .split(/(?<=[.!?])\s+/u)
    .flatMap((sentence) => sentence.split(/\s+/u).slice(1))
    .map((word) => word.replace(/[^\p{L}']/gu, ''))
    .filter((word) => /^\p{Lu}\p{Ll}/u.test(word) && !NOT_A_CLAIM.has(word));
}

function speechOf(move: TutoringTranscript['turns'][number]['moves'][number]): string {
  return 'speech' in move ? (move.speech?.text ?? '') : '';
}

function finding(
  transcript: TutoringTranscript,
  code: InvariantFinding['code'],
  eventId: string,
  message: string,
): InvariantFinding {
  return { code, scenarioId: transcript.scenarioId, eventId, message };
}
