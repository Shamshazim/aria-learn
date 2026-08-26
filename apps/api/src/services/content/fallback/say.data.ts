import type { BandVariants } from '@/services/content/fallback/fallback.types';

/**
 * The SAY approaches, which are different acts rather than different wordings (P2H-11).
 *
 * Asking a child to repeat themselves and gently checking whether they are still there are not
 * the same move, and one set of six sentences could not do both. `deflect-personal-info` is
 * deliberately absent: that one is reviewed fixed text on the nominal path, not a fallback.
 */
export const SAY_FALLBACKS: BandVariants = {
  early: [
    'Let us look at this together.',
    'I can help with this one.',
    'We can work this out.',
    'Let us take it a step at a time.',
    'Stay with me on this one.',
    'We will get there together.',
  ],
  middle: [
    'Let us look at this together.',
    'I can help with this one.',
    'We can work this out.',
    'Let us take it a step at a time.',
    'Stay with me on this one.',
    'We will get there.',
  ],
  senior: [
    'Let us look at this together.',
    'I can help with this one.',
    'We can work this out.',
    'Let us take it a step at a time.',
    'Stay with this one a moment.',
    'We will get there.',
  ],
};

export const CONFIRM_SPOKEN_ANSWER_FALLBACKS: BandVariants = {
  early: [
    'I did not catch that. Can you say it again?',
    'Say that once more for me.',
    'I missed it. One more time?',
    'Can you say that a bit louder?',
    'Tell me again, please.',
    'I did not hear you. Try again?',
  ],
  middle: [
    'I did not catch that — can you say it again?',
    'Say that once more for me.',
    'I missed that. One more time?',
    'Can you say that a little louder?',
    'Tell me that again, please.',
    'I did not hear you properly. Again?',
  ],
  senior: [
    'I did not catch that. Say it again?',
    'Say that once more for me.',
    'I missed that. One more time?',
    'Could you say that a little louder?',
    'Tell me that again.',
    'I did not hear it properly. Again?',
  ],
};

export const ANSWER_QUESTION_FALLBACKS: BandVariants = {
  early: [
    'Good thing to ask. We can find out as we go.',
    'That is a good question. Let us come back to it.',
    'I like that question. First, this one.',
    'Nice question. Let us finish this bit first.',
    'Good ask. Hold that thought.',
    'That is worth asking. Back to our question first.',
  ],
  middle: [
    'Good question. We can work that out as we go.',
    'That is worth asking — let us come back to it.',
    'I like that question. This one first, though.',
    'Nice question. Let us finish this bit first.',
    'Good ask. Hold on to that thought.',
    'That is a fair question. Back to ours first.',
  ],
  senior: [
    'Good question. We can work that out as we go.',
    'That is worth asking. Let us come back to it.',
    'Fair question. This one first, though.',
    'Good question. Let us finish this part first.',
    'Hold on to that one.',
    'That is a fair question. Back to ours first.',
  ],
};

export const ACKNOWLEDGE_CHAT_FALLBACKS: BandVariants = {
  early: [
    'Thanks for telling me. Now back to our question.',
    'I like hearing that. Let us keep going.',
    'Good to know. Back to this one.',
    'Thanks for that. Now this one.',
    'I hear you. Let us carry on.',
    'Nice one. Back to work.',
  ],
  middle: [
    'Thanks for telling me — back to our question.',
    'Good to hear. Let us keep going.',
    'Noted. Back to this one.',
    'Thanks for that. Now this one.',
    'I hear you. Let us carry on.',
    'Fair enough. Back to work.',
  ],
  senior: [
    'Thanks for telling me. Back to our question.',
    'Good to hear. Let us keep going.',
    'Noted. Back to this one.',
    'Thanks for that. Now this one.',
    'I hear you. Let us carry on.',
    'Fair enough. Back to it.',
  ],
};

export const REASK_SHORT_FALLBACKS: BandVariants = {
  early: [
    'No rush. What do you think?',
    'Take your time. What is your answer?',
    'Have a guess. What do you think it is?',
    'What do you reckon?',
    'Any idea? Say it out loud.',
    'What do you think the answer is?',
  ],
  middle: [
    'No rush — what do you think?',
    'Take your time. What is your answer?',
    'Have a go. What do you think it is?',
    'What do you reckon it is?',
    'Any idea? Say it out loud.',
    'What do you think the answer is?',
  ],
  senior: [
    'No rush. What do you think?',
    'Take your time. What is your answer?',
    'Have a go. What do you think it is?',
    'What do you reckon?',
    'Any idea? Say it out loud.',
    'What do you think the answer is?',
  ],
};

export const CHECK_IN_SAY_FALLBACKS: BandVariants = {
  early: [
    'Are you still there? Say something so I know.',
    'Still with me?',
    'Are you there? Tap or talk to me.',
    'Just checking you are still here.',
    'Say hello if you are still there.',
    'Are you okay? Let me know.',
  ],
  middle: [
    'Are you still there? Say something so I know.',
    'Still with me?',
    'Are you there? Tap or say something.',
    'Just checking you are still here.',
    'Say hello if you are still with me.',
    'Are you okay? Let me know.',
  ],
  senior: [
    'Are you still there? Say something so I know.',
    'Still with me?',
    'Are you there? Tap or say something.',
    'Just checking you are still here.',
    'Say something if you are still with me.',
    'Are you okay? Let me know.',
  ],
};

export const TEACH_FALLBACKS: BandVariants = {
  early: [
    'Here is the idea. Then you try it.',
    'Let me show you the one step first.',
    'Watch this bit, then have a go.',
    'This is how it works.',
    'Here is the trick to it.',
    'Let me do one, then you do one.',
  ],
  middle: [
    'Here is the idea, then you try it.',
    'Let me show you the one step first.',
    'Watch this part, then have a go.',
    'This is how it works.',
    'Here is the idea behind it.',
    'Let me do one, then you do one.',
  ],
  senior: [
    'Here is the idea, then you try it.',
    'Let me take you through the step first.',
    'Watch this part, then have a go.',
    'This is how it works.',
    'Here is the idea behind it.',
    'Let me do one, then you take one.',
  ],
};
