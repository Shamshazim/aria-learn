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
  'terminal',
] as const;

export type DecisiveReason = (typeof DECISIVE_REASONS)[number];

export function isDecisive(reasons: readonly string[]): boolean {
  return reasons.some((reason) => (DECISIVE_REASONS as readonly string[]).includes(reason));
}
