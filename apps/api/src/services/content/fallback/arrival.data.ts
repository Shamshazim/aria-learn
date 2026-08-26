import type { BandVariants } from '@/services/content/fallback/fallback.types';

/**
 * The moves that open a session or point at the screen (P2H-11).
 *
 * These are the least likely fallbacks to ever fire — arrival happens once and has its own
 * path — but they exist so that no move kind has a generic sentence hiding behind it. A move
 * with nothing written for it is how "Let us try one step." ended up answering everything.
 */
export const WELCOME_FALLBACKS: BandVariants = {
  early: [
    'Hello {name}. I am glad you are here.',
    'Hi again. Let us get started.',
    'Hello. Good to see you.',
    'Hi {name}. Ready when you are.',
    'Hello again. Let us do some work.',
    'Hi. I have something for us today.',
  ],
  middle: [
    'Hello {name}. Good to see you back.',
    'Hi again — let us get going.',
    'Hello. Ready when you are.',
    'Hi {name}. I have something lined up for us.',
    'Hello again. Let us pick this up.',
    'Hi. Good to have you here.',
  ],
  senior: [
    'Hello {name}. Good to see you.',
    'Hi again. Let us get to it.',
    'Hello. Ready when you are.',
    'Hi {name}. I have something ready.',
    'Hello again. Let us pick up where we left off.',
    'Hi. Good to have you back.',
  ],
};

export const CHECK_IN_FALLBACKS: BandVariants = {
  early: [
    'How are you doing today?',
    'How does this feel so far?',
    'Are you doing okay?',
    'How is it going?',
    'Is this one alright?',
    'How are you feeling about this?',
  ],
  middle: [
    'How are you doing today?',
    'How is this feeling so far?',
    'Are you okay with the pace?',
    'How is it going?',
    'Is this about the right level?',
    'How are you finding this?',
  ],
  senior: [
    'How are you doing today?',
    'How is this feeling so far?',
    'Is the pace working for you?',
    'How is it going?',
    'Is this about the right level?',
    'How are you finding it?',
  ],
};

export const RECOMMEND_FALLBACKS: BandVariants = {
  early: [
    'Let us work on {skillName} today.',
    'I think {skillName} is a good place to start.',
    'We could do {skillName} now.',
    'Shall we do some {skillName}?',
    'Let us pick up where we left off.',
    'How about we carry on from last time?',
  ],
  middle: [
    'Let us work on {skillName} today.',
    'I think {skillName} is the right place to start.',
    'We could pick up {skillName} now.',
    'Shall we work on {skillName}?',
    'Let us carry on from where we left off.',
    'How about we pick up from last time?',
  ],
  senior: [
    'Let us work on {skillName} today.',
    'I think {skillName} is the right place to start.',
    'We could pick up {skillName}.',
    'Shall we take {skillName}?',
    'Let us carry on from where we left off.',
    'How about we pick up from last time?',
  ],
};

export const ASK_FALLBACKS: BandVariants = {
  early: [
    'Here is your question.',
    'Try this one.',
    'Have a go at this.',
    'Here is one for you.',
    'This one is next.',
    'See what you think of this.',
  ],
  middle: [
    'Here is your question.',
    'Try this one.',
    'Have a go at this one.',
    'Here is the next one.',
    'This one is next.',
    'See what you make of this.',
  ],
  senior: [
    'Here is your question.',
    'Try this one.',
    'Have a go at this.',
    'Here is the next one.',
    'This one is next.',
    'See what you make of it.',
  ],
};

export const SHOW_FALLBACKS: BandVariants = {
  early: [
    'Look at this with me.',
    'Have a look here.',
    'Look at the picture.',
    'This one is worth a look.',
    'Take a look at this.',
    'Look here for a second.',
  ],
  middle: [
    'Look at this with me.',
    'Have a look at this.',
    'Look at the picture here.',
    'This is worth a look.',
    'Take a look at this one.',
    'Look here for a moment.',
  ],
  senior: [
    'Look at this with me.',
    'Have a look at this.',
    'Look at the diagram.',
    'This is worth a look.',
    'Take a look at this one.',
    'Look here for a moment.',
  ],
};

export const LISTEN_FALLBACKS: BandVariants = {
  early: [
    'Go ahead. I am listening.',
    'Say it when you are ready.',
    'I am listening.',
    'Off you go.',
    'Tell me when you are ready.',
    'You can say it out loud.',
  ],
  middle: [
    'Go ahead — I am listening.',
    'Say it whenever you are ready.',
    'I am listening.',
    'Off you go.',
    'Read it out when you are ready.',
    'You can say it out loud.',
  ],
  senior: [
    'Go ahead, I am listening.',
    'Say it whenever you are ready.',
    'I am listening.',
    'Whenever you are ready.',
    'Read it out when you want to.',
    'You can say it out loud.',
  ],
};
