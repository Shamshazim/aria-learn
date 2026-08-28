import type { Band } from '@aria/shared';

export const CONNECTION_FAILURE_COPY: Readonly<Record<Band, string>> = {
  early: 'Aria needs the internet. Ask a grown-up to check it, then try again.',
  middle: "Aria can't reach her brain right now. Check the internet and try again in a minute.",
  senior: "Aria can't reach her brain right now. Check the internet and try again in a minute.",
};

/** An answer that never reached Aria. Not the internet: that has its own sentence above. */
export const DELIVERY_FAILURE_COPY: Readonly<Record<Band, string>> = {
  early: "That didn't go through. Try again!",
  middle: "That didn't go through — try again.",
  senior: "That didn't go through — try again.",
};
