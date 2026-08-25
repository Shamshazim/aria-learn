import type { MoveKind, TutorInputEvent } from '@aria/shared';

const BY_EVENT: Readonly<Record<TutorInputEvent['kind'], readonly MoveKind[]>> = {
  ARRIVED: ['WELCOME', 'CHECK_IN', 'RECOMMEND'],
  SUBJECT_CHOSEN: ['SAY', 'SHOW', 'ASK', 'LISTEN'],
  ANSWER: ['PRAISE', 'HINT', 'RETEACH', 'REVEAL', 'SWITCH', 'END'],
  QUESTION: ['SAY', 'SHOW', 'ASK'],
  CONFUSED: ['RETEACH', 'SHOW', 'SWITCH', 'BREAK'],
  SPEECH_PARTIAL: ['SAY'],
  SPEECH_FINAL: ['PRAISE', 'HINT', 'RETEACH', 'SAY'],
  SILENCE: ['LISTEN', 'BREAK', 'SWITCH'],
  INTERRUPT: ['SAY', 'LISTEN'],
  BACKCHANNEL: ['SAY'],
  SPEECH_STARTED: ['SAY'],
  MEDIA_LOST: ['SAY'],
  MEDIA_RESTORED: ['SAY'],
  PAUSE: ['BREAK'],
  RESUME: ['SAY', 'ASK'],
  LEAVE: ['END'],
};

export function allowedMovesFor(event: TutorInputEvent): readonly MoveKind[] {
  return BY_EVENT[event.kind];
}
