/**
 * What kind of thing the child just said (P2H-05).
 *
 * Intents map onto existing moves; they are not new event kinds. `ANSWER` is graded, the
 * others are detours the policy handles before any grading happens.
 */
export const INTENTS = ['ANSWER', 'QUESTION', 'CONFUSED', 'CHAT', 'STOP_REQUEST'] as const;

export type Intent = (typeof INTENTS)[number];

export type IntentResult = Readonly<{
  intent: Intent;
  /** 0–1; rules give 0.9 for a matched pattern, 0.6 for the default `ANSWER`. */
  confidence: number;
  matchedRule: string | null;
}>;

export type IntentHints = Readonly<{
  /** The open item's answer key, when there is one; `null` for open responses. */
  answerKey: string | null;
}>;
