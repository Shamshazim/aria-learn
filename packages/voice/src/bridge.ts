import { decideBridge, type BridgeContext, type BridgeSkipRule } from './bridge-rules';

import type { BridgeClip, BridgePicker } from './bridge-picker';

export type BridgeChoice =
  Readonly<{ play: true; clip: BridgeClip }> | Readonly<{ play: false; rule: BridgeSkipRule }>;

/**
 * The whole bridge decision, in one call the worker makes and nothing else does (P2H-09).
 *
 * The rules say whether a gap is worth covering and with what kind of thing; the picker says
 * which recorded clip. Neither writes a sentence: every word a bridge can say was written,
 * reviewed and synthesised long before this session started, which is what keeps the tutor
 * model off the path to the first sound.
 */
export function chooseBridge(
  input: Readonly<{
    context: BridgeContext;
    clips: readonly BridgeClip[];
    picker: BridgePicker;
    turnIndex: number;
  }>,
): BridgeChoice {
  const decision = decideBridge(input.context);
  if (!decision.play) return decision;
  const clip = input.picker.pick({
    bucket: decision.bucket,
    clips: input.clips,
    turnIndex: input.turnIndex,
  });
  // An empty library is not an error: it is a deployment where nobody has recorded the clips
  // yet, and a child in it simply hears the answer with nothing in front of it.
  return clip === null ? { play: false, rule: 'no-clip' } : { play: true, clip };
}

/**
 * A bridge may never judge an answer. Only the gated reply is allowed to say "right" or "no",
 * because only it has seen what the child actually said — this is what makes a mis-bucketed
 * bridge harmless rather than a second voice contradicting the first.
 */
export function bridgeTextIsNonCommittal(text: string): boolean {
  return !/\b(correct|incorrect|right|wrong|yes|no)\b/iu.test(text);
}
