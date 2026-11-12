/**
 * The reasons that end a turn's argument before it starts (P2H-06).
 *
 * When one of these holds there is nothing for a planner to weigh: the session is over, the
 * child asked to stop, they said something that must not travel, or the ladder has already
 * decided what comes next. The planner is skipped entirely — not asked and overruled — so a
 * slow or unavailable model cannot delay a decision that was never open.
 */
export const DECISIVE_REASONS = [
  'session_limit',
  'stop_request',
  'personal_info',
  'unclear',
  'low_confidence_speech',
  'repeated_misconception',
  'silence_rung_3',
  'silence_rung_4',
  // The child asked for a different question, or has had three turns that went nowhere:
  // the answer is shown and the lesson moves on. Nothing to weigh.
  'skip_child_asked',
  'skip_not_engaging',
  'skip_too_hard',
  'skip_too_easy',
  'stuck_move_on',
  'mastered_topic',
  // P3-05: a check-in is reviewed fixed text, an adaptation is the policy's own response to a
  // confident inference, and a reply to a check-in was the child's decision.
  'engagement_check_in',
  'engagement_adapt',
  'engagement_reply',
  'engagement_noted',
  // P3-06: the child corrected their own memory; the acknowledgement is fixed text.
  'self_correction',
] as const;

export type DecisiveReason = (typeof DECISIVE_REASONS)[number];

export function isDecisive(reasons: readonly string[]): boolean {
  return reasons.some((reason) => (DECISIVE_REASONS as readonly string[]).includes(reason));
}
