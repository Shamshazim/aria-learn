/**
 * The visual models Aria can put on screen (P2H-10).
 *
 * These are the *kinds*, not the payloads: the protocol carries a `visual` string and its
 * renderer-specific `params` (`content.schema.ts`), and this union is what stops the two ends
 * disagreeing about which strings exist. A skill declares the kinds it can be shown with, so a
 * `RETEACH` that asks for a visual model gets one that fits the skill rather than the first
 * builder in a switch.
 */
export const VISUAL_KINDS = [
  'number-line',
  'ten-frame',
  'array',
  'fraction-bar',
  'place-value-blocks',
] as const;

export type VisualKind = (typeof VISUAL_KINDS)[number];
