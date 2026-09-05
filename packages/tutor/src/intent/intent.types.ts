/**
 * What kind of thing the child just said (P2H-05).
 *
 * Intents map onto existing moves; they are not new event kinds. `ANSWER` is graded, the
 * others are detours the policy handles before any grading happens. Treating "I have a cat"
 * as a wrong answer to "what is four plus three" is the single most machine-like thing a
 * tutor can do, and it is what happened before this existed.
 *
 * `OFF_TOPIC` is deliberately absent: it needs a three-in-a-row counter that lives in session
 * state, and P2H-05 does not build session state. Chat that drifts is `CHAT` until then.
 */
export const INTENTS = [
  'ANSWER',
  'QUESTION',
  'CONFUSED',
  'CHAT',
  'STOP_REQUEST',
  /** "Skip", "next one", "I give up": the child wants a different question, not more help. */
  'SKIP_REQUEST',
  /** The child volunteered a surname, address, phone number, email or school. */
  'PERSONAL_INFO',
  /** Nothing usable came through — bad audio, a fragment, silence with a cough in it. */
  'UNCLEAR',
] as const;

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
  /** Speech-to-text confidence, when the utterance was spoken. */
  speechConfidence?: number | undefined;
}>;

/** Below this, the rules are guessing and a model second pass is worth its latency. */
export const MODEL_PASS_CONFIDENCE = 0.7;
