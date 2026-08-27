import type { BandVariants } from '@/services/content/fallback/fallback.types';

/**
 * How a session stops when Aria has nothing of her own to say (P2H-11).
 *
 * No digits anywhere in these, on purpose: `master-plan.md` §14 rules a score out of an
 * ending, and a fallback is not exempt from a rule the generated version is held to. None of
 * them claims the child learned something specific either — a static string does not know.
 */
export const BREAK_FALLBACKS: BandVariants = {
  early: [
    'We can stop for now.',
    'Let us take a break.',
    'That is enough for today.',
    'We can pick this up later.',
    'Time for a rest.',
    'Let us stop here for now.',
  ],
  middle: [
    'We can stop here for now.',
    'Let us take a break.',
    'That is enough for today.',
    'We can pick this up next time.',
    'Good place to stop.',
    'Let us leave it there for now.',
  ],
  senior: [
    'We can stop here.',
    'Let us take a break.',
    'That is enough for today.',
    'We can pick this up next time.',
    'Good place to stop.',
    'Let us leave it there.',
  ],
};

export const END_FALLBACKS: BandVariants = {
  early: [
    'That is us for today. See you next time.',
    'We are done for today. Well played sticking with it.',
    'That is the end for now. See you soon.',
    'We will stop there. Come back and we will do more.',
    'That is it for today. Bye for now.',
    'We are finished for today. See you next time.',
  ],
  middle: [
    'That is us for today. See you next time.',
    'We are done for now — you stayed with it, and that is the part that counts.',
    'That is the end for today. See you soon.',
    'We will stop there. Come back and we will keep going.',
    'That is it for today. Bye for now.',
    'We are finished for today. See you next time.',
  ],
  senior: [
    'That is us for today. See you next time.',
    'We are done for now. You stayed with it, which is the part that counts.',
    'That is the end for today. See you soon.',
    'We will stop there. Come back and we will keep going.',
    'That is it for today. Bye for now.',
    'We are finished for today. See you next time.',
  ],
};
