import type { Intent } from '../intent.types';

/**
 * Sixty-four things a child actually says, hand-labelled (P2H-05).
 *
 * The label is what a human tutor would say the child meant, not what a regex can see. That
 * gap is the point: the rules are held to ≥ 90% agreement, and the utterances they get wrong
 * are the ones the model second pass exists to catch. Do not relabel one to make a rule pass.
 *
 * `answerKey` is the open item's key at the time, because the same words mean different things
 * against different questions — "seven" is an answer to "four plus three" and chat otherwise.
 */
export type LabelledUtterance = Readonly<{
  text: string;
  answerKey: string | null;
  expected: Intent;
  /** Why a human reads it that way, when it is not obvious. */
  note?: string;
}>;

export const UTTERANCE_FIXTURE: readonly LabelledUtterance[] = [
  // Answers — the common case, in every form a child gives one.
  { text: '7', answerKey: '7', expected: 'ANSWER' },
  { text: 'seven', answerKey: '7', expected: 'ANSWER' },
  { text: 'Seven!', answerKey: '7', expected: 'ANSWER' },
  { text: 'i think its seven', answerKey: '7', expected: 'ANSWER' },
  { text: 'the answer is seven', answerKey: '7', expected: 'ANSWER' },
  { text: 'is it seven?', answerKey: '7', expected: 'ANSWER', note: 'An answer, hedged.' },
  { text: 'twelve', answerKey: '12', expected: 'ANSWER' },
  { text: 'one half', answerKey: 'one half', expected: 'ANSWER' },
  { text: 'b', answerKey: 'b', expected: 'ANSWER' },
  { text: 'i got 15', answerKey: '15', expected: 'ANSWER' },
  { text: 'maybe 8', answerKey: '8', expected: 'ANSWER' },
  { text: '4 plus 3 is 7', answerKey: '7', expected: 'ANSWER' },
  { text: 'nine', answerKey: '7', expected: 'ANSWER', note: 'Wrong, but still an answer.' },
  { text: '20', answerKey: '7', expected: 'ANSWER' },
  { text: 'a hundred', answerKey: '7', expected: 'ANSWER' },

  // Questions.
  { text: 'what does regrouping mean?', answerKey: '7', expected: 'QUESTION' },
  { text: 'why do we carry the one', answerKey: '7', expected: 'QUESTION' },
  { text: 'how many pieces are there', answerKey: '4', expected: 'QUESTION' },
  { text: 'can you say it again', answerKey: '7', expected: 'QUESTION' },
  { text: 'is a half bigger than a quarter?', answerKey: '7', expected: 'QUESTION' },
  { text: 'what happens if the number is bigger', answerKey: '7', expected: 'QUESTION' },
  { text: 'do i add or subtract', answerKey: '7', expected: 'QUESTION' },
  { text: 'where does the ten go?', answerKey: '7', expected: 'QUESTION' },
  { text: 'which one is the numerator', answerKey: '7', expected: 'QUESTION' },
  { text: 'are you a robot?', answerKey: '7', expected: 'QUESTION' },

  // Confusion.
  { text: "i don't get it", answerKey: '7', expected: 'CONFUSED' },
  { text: 'i dont understand', answerKey: '7', expected: 'CONFUSED' },
  { text: 'huh', answerKey: '7', expected: 'CONFUSED' },
  { text: "i'm lost", answerKey: '7', expected: 'CONFUSED' },
  { text: 'this is too hard', answerKey: '7', expected: 'CONFUSED' },
  { text: 'what do you mean', answerKey: '7', expected: 'CONFUSED' },
  { text: 'im confused about the pieces', answerKey: '7', expected: 'CONFUSED' },
  { text: "i don't know", answerKey: '7', expected: 'CONFUSED' },

  // Chat: real, and the reason grading everything was wrong.
  { text: 'i have a cat called biscuit', answerKey: '7', expected: 'CHAT' },
  { text: 'my sister is annoying', answerKey: '7', expected: 'CHAT' },
  { text: 'we went swimming today', answerKey: '7', expected: 'CHAT' },
  { text: 'i like your voice', answerKey: '7', expected: 'CHAT' },
  { text: 'my dog ate my pencil', answerKey: '7', expected: 'CHAT' },
  { text: 'i want to be an astronaut', answerKey: '7', expected: 'CHAT' },
  { text: 'im tired today', answerKey: '7', expected: 'CHAT' },
  { text: 'we have a test tomorrow', answerKey: '7', expected: 'CHAT' },
  { text: 'my birthday is soon', answerKey: '7', expected: 'CHAT' },

  // Wanting a different question: not confusion, not stopping.
  { text: 'skip this one', answerKey: '7', expected: 'SKIP_REQUEST' },
  { text: 'can we do a different question', answerKey: '7', expected: 'SKIP_REQUEST' },
  { text: 'next one please', answerKey: '7', expected: 'SKIP_REQUEST' },
  { text: 'i give up', answerKey: '7', expected: 'SKIP_REQUEST' },

  // Stopping.
  { text: 'stop', answerKey: '7', expected: 'STOP_REQUEST' },
  { text: 'i want to stop', answerKey: '7', expected: 'STOP_REQUEST' },
  { text: "i'm done", answerKey: '7', expected: 'STOP_REQUEST' },
  { text: 'all done', answerKey: '7', expected: 'STOP_REQUEST' },
  { text: 'no more please', answerKey: '7', expected: 'STOP_REQUEST' },
  { text: 'bye', answerKey: '7', expected: 'STOP_REQUEST' },
  { text: 'can i go now', answerKey: '7', expected: 'STOP_REQUEST' },

  // Personal information: never graded, never stored, never sent onward.
  { text: 'my name is Priya Shah', answerKey: '7', expected: 'PERSONAL_INFO' },
  { text: 'my last name is Okafor', answerKey: '7', expected: 'PERSONAL_INFO' },
  { text: 'i live at 14 Maple Street', answerKey: '7', expected: 'PERSONAL_INFO' },
  { text: 'we live at 88 Oak Road', answerKey: '7', expected: 'PERSONAL_INFO' },
  { text: 'my address is 3 Rose Lane', answerKey: '7', expected: 'PERSONAL_INFO' },
  { text: 'my number is 555-123-4567', answerKey: '7', expected: 'PERSONAL_INFO' },
  { text: 'you can email me at kid@example.test', answerKey: '7', expected: 'PERSONAL_INFO' },
  { text: 'i go to Bramble Hill School', answerKey: '7', expected: 'PERSONAL_INFO' },
  { text: 'my school is called Oakfield Academy', answerKey: '7', expected: 'PERSONAL_INFO' },

  // Nothing usable came through.
  { text: '', answerKey: '7', expected: 'UNCLEAR' },
  { text: '   ', answerKey: '7', expected: 'UNCLEAR' },
];
