import type { BandVariants } from '@/services/content/fallback/fallback.types';

/**
 * The reviewed things Aria says about an attempt when she cannot say her own (P2H-11).
 *
 * Six per band because the picker never repeats the last one and a child hears these across a
 * whole session: three would be a loop they can hear. None of them says "good job" — a static
 * string cannot be specific, so it does not pretend to be, and it hands the turn onward instead.
 */
export const PRAISE_FALLBACKS: BandVariants = {
  early: [
    'Yes. That is right.',
    'That is it. You got {answer}.',
    'Yes — {answer} is the one.',
    'You got there.',
    'That is right. Here is the next one.',
    'Yes. Let us do one more.',
  ],
  middle: [
    'That is right — {answer}.',
    'Yes, {answer} is the answer. Ready for another?',
    'You got it. Let us keep going.',
    'That is the one. Next question.',
    'Right answer. On we go.',
    'Yes. That is exactly it.',
  ],
  senior: [
    'Correct — {answer}.',
    'That is right. Let us take the next one.',
    'Yes, {answer}. Moving on.',
    'You have it. Next.',
    'That is the answer. Keep going.',
    'Right. On to the next.',
  ],
};

export const REVEAL_FALLBACKS: BandVariants = {
  early: [
    'The answer is {answer}. Let us do one like it.',
    'It was {answer}. We can try another.',
    'The answer is {answer}. Now you know it.',
    'It comes out to {answer}. Let us look at one more.',
    'Let me show you this one. Then we will do another.',
    'Here is how this one goes. We will do it again together.',
  ],
  middle: [
    'The answer is {answer}. Let us do one of the same kind.',
    'It works out to {answer}. Here is another to try.',
    'The answer here is {answer}. That was a hard one.',
    'It is {answer}. We will take another run at this kind.',
    'Let me show you how this one goes. Then we take another.',
    'Here is the way through this one. Try the next with me.',
  ],
  senior: [
    'The answer is {answer}. Let us do another of the same kind.',
    'It works out to {answer}. Here is one more.',
    'The answer here is {answer}. That one was worth the time.',
    'It is {answer}. We will take another of these.',
    'Let me show you how this one goes. Then we take another.',
    'Here is the way through it. Try the next one.',
  ],
};

/**
 * The child asked to skip, or has had three turns that went nowhere. The answer, said kindly
 * and briefly, and a fresh question on its way — never a fourth asking of the same one.
 */
export const REVEAL_MOVE_ON_FALLBACKS: BandVariants = {
  early: [
    'No problem. The answer is {answer}. Let us try a new one.',
    'That is okay. It was {answer}. Here comes a different one.',
    'Okay. The answer is {answer}. New one coming up.',
    'Sure. It was {answer}. Let us do another.',
    'That is fine. Let us leave that one and try a new one.',
    'Okay, we can skip it. Here is a different one.',
  ],
  middle: [
    'No problem. The answer was {answer}. Let us try a different one.',
    'That is fine — it was {answer}. Here is a new one.',
    'Okay. The answer is {answer}. Moving to a fresh question.',
    'Sure. It works out to {answer}. Let us do another.',
    'Fair enough. Let us leave that one and try something different.',
    'Okay, we will skip it. Here is a different question.',
  ],
  senior: [
    'No problem. The answer was {answer}. Let us move to a different one.',
    'That is fine — it was {answer}. Here is a new one.',
    'Okay. The answer is {answer}. On to a fresh question.',
    'Sure. It comes out to {answer}. Let us take another.',
    'Fair enough. We will leave that one and try something different.',
    'Okay, we will skip it. Here is a different question.',
  ],
};

/** Three right in a row: the topic is done for today, and the next one is named. */
export const SWITCH_NEXT_TOPIC_FALLBACKS: BandVariants = {
  early: [
    'Yes. That is three in a row. Let us try {skillName} now.',
    'You have got this one. Now we do {skillName}.',
    'That is right again. Time for something new: {skillName}.',
    'Yes. You know this now. Next is {skillName}.',
    'That is right. You are ready for the next thing.',
    'Yes. Let us move on to something new.',
  ],
  middle: [
    'That is right — three in a row. Let us move on to {skillName}.',
    'You have this one down. Next up is {skillName}.',
    'Right again. Time for something new: {skillName}.',
    'Yes. That is enough of these. Let us try {skillName}.',
    'That is right. You are ready for the next topic.',
    'Yes. Let us move on to something new.',
  ],
  senior: [
    'Correct — three in a row. Let us move on to {skillName}.',
    'You have this one. Next is {skillName}.',
    'Right again. On to something new: {skillName}.',
    'Yes. That is enough of these; let us take {skillName}.',
    'Correct. You are ready for the next topic.',
    'Right. Let us move on to something new.',
  ],
};

export const HINT_FALLBACKS: BandVariants = {
  early: [
    'Look at the first part.',
    'Try the smaller number first.',
    'Start with what you know.',
    'Count it out slowly.',
    'Look at the question again.',
    'Say the first step out loud.',
  ],
  middle: [
    'Start with the first step and stop there.',
    'Look at what the question is asking for.',
    'Try the easier half first.',
    'Work it out one step at a time.',
    'Write down what you already know.',
    'Say the first move out loud, then do it.',
  ],
  senior: [
    'Take the first step and stop there.',
    'Read what the question is actually asking for.',
    'Start with the part you are sure of.',
    'Work it one step at a time.',
    'Write down what you know before you solve.',
    'Name the first move, then make it.',
  ],
};

export const RETEACH_FALLBACKS: BandVariants = {
  early: [
    'Let us look at this a different way.',
    'We can start again from the top.',
    'Here is another way to see it.',
    'Let us take one small step first.',
    'We can draw it out instead.',
    'Let us slow this one down.',
  ],
  middle: [
    'Let us come at this a different way.',
    'We will start again from the beginning.',
    'Here is another way to think about it.',
    'Let us take the smallest version of this first.',
    'We can draw it instead of writing it.',
    'Let us slow this one right down.',
  ],
  senior: [
    'Let us come at this from a different angle.',
    'We will start again from the beginning.',
    'Here is another way to think about it.',
    'Let us take the simplest case first.',
    'We can sketch it instead.',
    'Let us slow this one down.',
  ],
};

export const SWITCH_FALLBACKS: BandVariants = {
  early: [
    'Let us try a different one first.',
    'We can come back to this one later.',
    'Here is a different question for now.',
    'Let us go a step back first.',
    'We will park this one for a bit.',
    'Let us try something else.',
  ],
  middle: [
    'Let us try a different step first.',
    'We can come back to this one later.',
    'Here is a different question for now.',
    'Let us drop back a step and build up.',
    'We will park this one for a moment.',
    'Let us switch to something else and return.',
  ],
  senior: [
    'Let us take a different step first.',
    'We can come back to this one.',
    'Here is a different question for now.',
    'Let us drop back a step and build up again.',
    'We will park this one.',
    'Let us switch and come back to it.',
  ],
};
