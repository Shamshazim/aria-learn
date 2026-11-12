import type { PlannedTurn } from '@aria/tutor';

import type { QualityGate } from '@/quality';
import { passesGate } from '@/services/content/generate-text';
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
  if (turn.plan.kind !== 'SAY') return null;
  if (turn.plan.approach === 'acknowledge-correction') return acknowledgeCorrection(turn);
  if (turn.plan.approach !== 'deflect-personal-info') return null;
  return DEFLECT_PERSONAL_INFO[turn.context.session.band] ?? DEFLECT_PERSONAL_INFO.middle ?? null;
}

/** Plain words only, short: the most of a child's sentence Aria repeats back. */
const ECHOABLE = /^[a-z][a-z' -]{1,29}$/u;
/** What Aria says when the child's own word cannot be repeated, or the gate refuses it. */
export const GENERIC_ACKNOWLEDGEMENT = 'Got it, thanks for telling me.';

/**
 * P3-06: one sentence when a child corrects what Aria knew — "Got it, no more trucks." — and
 * then the lesson. The child's own word is repeated only when it is a plain short word; any
 * other shape gets the generic sentence, because a self-correction is not a reason to read a
 * child's free text back to them. A grade is acknowledged and nothing more: it is the
 * grown-up's to change.
 */
function acknowledgeCorrection(turn: PlannedTurn<ApiModelContext>): string {
  const evidence = turn.plan.evidence ?? {};
  const echo = (key: string): string | null => {
    const value = evidence[key];
    return typeof value === 'string' && ECHOABLE.test(value) ? value : null;
  };
  if (evidence.selfCorrection === 'stopped_liking') {
    const thing = echo('selfCorrectionThing');
    return thing === null ? GENERIC_ACKNOWLEDGEMENT : `Got it, no more ${thing}.`;
  }
  if (evidence.selfCorrection === 'renamed') {
    const name = echo('selfCorrectionName');
    return name === null ? GENERIC_ACKNOWLEDGEMENT : `Got it, ${capitalise(name)} it is.`;
  }
  return GENERIC_ACKNOWLEDGEMENT;
}

function capitalise(word: string): string {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

/**
 * P3-06: an acknowledgement that repeats the child's word, and the gate would not say it —
 * the generic sentence instead, rather than a turn that fails over one word.
 */
export function acknowledged(
  gate: QualityGate,
  turn: PlannedTurn<ApiModelContext>,
  text: string,
): string {
  if (turn.plan.approach !== 'acknowledge-correction') return text;
  return passesGate(gate, text, turn.context.session.band, { generated: false })
    ? text
    : GENERIC_ACKNOWLEDGEMENT;
}
