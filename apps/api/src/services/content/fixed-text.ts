import type { PlannedTurn } from '@aria/tutor';

import type { ApiModelContext } from '@/services/content/turn-content.service';

/**
 * The few things Aria says from a reviewed script rather than in her own words (P2H-05).
 *
 * Deflecting personal information is one of them. A model asked to improvise here could
 * repeat back the address it was asked not to keep, or turn the deflection into a question,
 * and neither is recoverable. The wording was reviewed once; it does not need to be creative.
 *
 * This is not the fallback path — nothing failed. `fallback_used_total` must not fire for it.
 */
const DEFLECT_PERSONAL_INFO: Readonly<Record<string, string>> = {
  early: "Thanks for telling me. Let's keep that just for your grown-ups.",
  middle:
    "Thanks for telling me — but let's keep things like that between you and your grown-ups. Back to the question.",
  senior:
    "I'd rather you kept details like that off here — keep them between you and your family. Let's get back to it.",
};

export function fixedText(turn: PlannedTurn<ApiModelContext>): string | null {
  if (turn.plan.kind !== 'SAY' || turn.plan.approach !== 'deflect-personal-info') return null;
  return DEFLECT_PERSONAL_INFO[turn.context.session.band] ?? DEFLECT_PERSONAL_INFO.middle ?? null;
}
