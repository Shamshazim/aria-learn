import {
  PROTOCOL_VERSION,
  tutorMoveSchema,
  type TutorInputEvent,
  type TutorMove,
} from '@aria/shared';

import type { TutorSource } from '@/features/session/model/tutor-source';

export function createScriptedSource(): TutorSource {
  let closed = false;
  let sequence = 0;
  let wrongAnswerAttempts = 0;
  const make = (input: Record<string, unknown>): TutorMove => {
    sequence += 1;
    return tutorMoveSchema.parse({
      id: `scripted-move-${String(sequence)}`,
      at: new Date(sequence * 1_000).toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      display: [],
      expects: 'none',
      speech: null,
      ...input,
    });
  };
  return {
    // Scripted moves arrive whole; nothing here is generated, so there is nothing to stream.
    send: async function* (event, signal): AsyncIterable<TutorMove> {
      for (const move of movesFor(event, make, () => {
        wrongAnswerAttempts += 1;
        return wrongAnswerAttempts;
      })) {
        await Promise.resolve();
        if (closed || signal?.aborted === true) return;
        yield move;
      }
    },
    close: () => {
      closed = true;
    },
  };
}

type MakeMove = (input: Record<string, unknown>) => TutorMove;

function movesFor(
  event: TutorInputEvent,
  make: MakeMove,
  nextAnswerAttempt: () => number,
): readonly TutorMove[] {
  switch (event.kind) {
    case 'ARRIVED':
      return arrivalMoves(make);
    case 'SUBJECT_CHOSEN':
      return teachingMoves(make);
    case 'ANSWER':
      return answerMoves(make, event, nextAnswerAttempt);
    case 'QUESTION':
      return [make(speechMove('SAY', 'That is a thoughtful question. Let us look together.'))];
    case 'CONFUSED':
      return [
        make({
          ...speechMove('RETEACH', 'Let us try a picture instead.'),
          misconception: 'The first representation did not connect.',
        }),
      ];
    case 'SPEECH_PARTIAL':
    case 'BACKCHANNEL':
    case 'SPEECH_STARTED':
    case 'MEDIA_LOST':
      return [];
    default:
      return sessionEventMoves(event, make);
  }
}

type SessionEvent = Extract<
  TutorInputEvent,
  {
    kind:
      'SPEECH_FINAL' | 'SILENCE' | 'INTERRUPT' | 'MEDIA_RESTORED' | 'PAUSE' | 'RESUME' | 'LEAVE';
  }
>;

function sessionEventMoves(event: SessionEvent, make: MakeMove): readonly TutorMove[] {
  switch (event.kind) {
    case 'SPEECH_FINAL':
      return [
        make({
          ...speechMove('PRAISE', 'You explained your idea clearly.'),
          because: 'you named your reasoning',
        }),
      ];
    case 'SILENCE':
      return [
        make({
          ...speechMove('LISTEN', 'Take your time. Tell me when you are ready.'),
          expects: 'speech',
          purpose: 'answer',
        }),
      ];
    case 'INTERRUPT':
      return [make(speechMove('SAY', 'Go ahead.'))];
    case 'MEDIA_RESTORED':
      return [make(speechMove('SAY', 'We are connected again. Your work is still here.'))];
    case 'PAUSE':
      return [
        make({ ...speechMove('BREAK', 'Let us take a short break.'), reason: 'child_asked' }),
      ];
    case 'RESUME':
      return [
        make({
          ...speechMove('SWITCH', 'Welcome back. We can continue here.'),
          reason: 'Session resumed after a break.',
        }),
      ];
    case 'LEAVE':
      return [
        make({
          ...speechMove('END', 'You kept thinking even when it was hard.'),
          learned: ['You used counting on.'],
          reason: 'child_left',
        }),
      ];
    default:
      return assertNever(event);
  }
}

function arrivalMoves(make: MakeMove): readonly TutorMove[] {
  return [
    make({
      ...speechMove('WELCOME', 'Welcome back. You stayed with a hard problem last time.'),
      basedOn: ['prior-session-1'],
    }),
    make({
      ...speechMove('CHECK_IN', 'Would you like an easy start or a challenge?'),
      expects: 'choice',
      about: 'difficulty',
    }),
    make({
      ...speechMove('RECOMMEND', 'Math is ready when you are.'),
      expects: 'choice',
      subjectId: 'math',
      grade: '4',
      reason: 'A short warm-up is due.',
    }),
  ];
}

function teachingMoves(make: MakeMove): readonly TutorMove[] {
  return [
    make(speechMove('SAY', 'We can count on from four.')),
    make({
      ...speechMove('SHOW', 'Picture four dots, then add three.'),
      display: [
        {
          type: 'visual',
          visual: 'dot-groups',
          params: { first: 4, second: 3 },
          alt: 'Four dots and three more dots',
        },
      ],
    }),
    make({
      ...speechMove('ASK', 'What is four plus three?'),
      expects: 'choice',
      itemId: 'four-plus-three',
      attempt: 1,
      display: [
        {
          type: 'choices',
          options: [
            { id: '6', label: '6' },
            { id: '7', label: '7' },
            { id: '8', label: '8' },
          ],
        },
      ],
    }),
  ];
}

function answerMoves(
  make: MakeMove,
  event: Extract<TutorInputEvent, { kind: 'ANSWER' }>,
  nextWrongAttempt: () => number,
): readonly TutorMove[] {
  if (event.text === '7' || event.choiceId === '7') {
    return [
      make({
        ...speechMove('PRAISE', 'Yes. You counted on from four.'),
        because: 'you counted on instead of restarting',
      }),
    ];
  }
  const attempt = nextWrongAttempt();
  if (attempt === 1) {
    return [
      make({ ...speechMove('HINT', 'Start at four and count on three.'), attempt: 1 }),
      make({
        ...speechMove('ASK', 'Try four plus three again.'),
        expects: 'number',
        itemId: 'four-plus-three',
        attempt: 2,
      }),
    ];
  }
  if (attempt === 2) {
    return [
      make({
        ...speechMove('RETEACH', 'Let us draw four dots and then three dots.'),
        misconception: 'Counting restarted instead of counting on.',
      }),
      make({ ...speechMove('REVEAL', 'Four plus three is seven.'), answer: '7' }),
    ];
  }
  return [make({ ...speechMove('REVEAL', 'Four plus three is seven.'), answer: '7' })];
}

function speechMove(kind: TutorMove['kind'], text: string): Record<string, unknown> {
  return { kind, speech: { text }, display: [], expects: 'none' };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled event: ${String(value)}`);
}
