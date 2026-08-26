import type { BridgeBucket } from '@aria/voice';

/**
 * Twelve- to fourteen-year-olds (P2H-09).
 *
 * One bucket, because rule 6 will only ever play them one: everything other than "let me
 * think" reads as filler to this age. The other four are deliberately not written — a clip the
 * rules cannot play is a clip somebody would have to sit and review for nothing, and P2-11b is
 * where bulk generation lives.
 */
export const SENIOR_BRIDGE_SEED: Readonly<Partial<Record<BridgeBucket, readonly string[]>>> = {
  thinking: [
    'Hmm.',
    'Let me think.',
    'Good question.',
    'Give me a second.',
    'Let me work that through.',
    'Hmm, one moment.',
    'Worth thinking about.',
    'Let me get that straight.',
  ],
};
