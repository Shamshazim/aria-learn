import { bandForGrade, type TutorInputEvent, type TutorMove } from '@aria/shared';

import type { TurnEvidence, TutoringScenario } from '@/testing/tutoring/scenario';

export type TranscriptTurn = Readonly<{
  event: TutorInputEvent;
  moves: readonly TutorMove[];
  durationMs: number;
  evidence: TurnEvidence;
}>;

export type TutoringTranscript = Readonly<{
  scenarioId: string;
  title: string;
  grade: TutoringScenario['grade'];
  description: string;
  context: TutoringScenario['context'];
  turns: readonly TranscriptTurn[];
}>;

function oneLine(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function formatMove(move: TutorMove): string {
  const spoken = move.speech === null ? '[no speech]' : oneLine(move.speech.text);
  return [
    `- ${move.kind} \`${move.id}\`: ${spoken}`,
    '',
    '  ```json',
    JSON.stringify(move, null, 2)
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n'),
    '  ```',
  ].join('\n');
}

function formatList(values: readonly string[]): string {
  return values.length === 0 ? 'none' : values.join(', ');
}

function formatEvidence(evidence: TurnEvidence): string {
  const affectClaims = evidence.affectClaims.map(
    (claim) => `${claim.observationId} via ${claim.moveId}`,
  );
  return [
    `- Approach: ${evidence.approachId ?? 'none'}`,
    `- Asserted facts: ${formatList(evidence.assertedFactIds)}`,
    `- Affect claims: ${formatList(affectClaims)}`,
    `- Response origin: ${evidence.responseOrigin}`,
    `- Crisis routed: ${String(evidence.crisisRouted)}`,
    `- Stopped moves: ${formatList(evidence.stoppedMoveIds)}`,
  ].join('\n');
}

function formatTurn(turn: TranscriptTurn, index: number): string {
  const moves =
    turn.moves.length === 0 ? '- No moves emitted.' : turn.moves.map(formatMove).join('\n');
  return [
    `## Turn ${String(index + 1)} — ${turn.event.kind}`,
    '',
    `Event \`${turn.event.id}\` · ${String(turn.durationMs)} ms`,
    '',
    '```json',
    JSON.stringify(turn.event, null, 2),
    '```',
    '',
    '### Aria moves',
    '',
    moves,
    '',
    '### Evidence',
    '',
    formatEvidence(turn.evidence),
  ].join('\n');
}

/** Produces a transcript a tutor can review in any Markdown viewer. */
export function formatTranscript(transcript: TutoringTranscript): string {
  const header = [
    `# ${transcript.title}`,
    '',
    `Scenario: \`${transcript.scenarioId}\``,
    '',
    `Grade: ${transcript.grade} · Band: ${bandForGrade(transcript.grade)}`,
    '',
    transcript.description,
    '',
    '## Assumed learner context',
    '',
    '```json',
    JSON.stringify(transcript.context, null, 2),
    '```',
  ].join('\n');
  return `${header}\n\n${transcript.turns.map(formatTurn).join('\n\n')}\n`;
}
