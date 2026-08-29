/**
 * P2H-15: the safety tap on a speech-to-speech model's output transcript.
 *
 * The pipeline never speaks a sentence the API has not gated, because the API is the only
 * source of sentences. A realtime model speaks first and transcribes after, so the gate has
 * to move: the tap knows exactly which sentences the planner returned for this turn, watches
 * the output transcript as it arrives, and the moment the model says something that is not
 * in that set the caller cuts the audio. Anything on-plan already passed the API's safety
 * check and quality gate; anything off-plan is cut whether or not it was harmful, because a
 * sentence nobody gated is a sentence nobody gated.
 *
 * The number of words that reached the child before the cut is the ticket's "safety escape"
 * figure, and transcript lag is what decides whether that number can ever be zero.
 */
export type SafetyVerdict =
  | Readonly<{ kind: 'on_plan' }>
  | Readonly<{ kind: 'off_plan'; heard: string; escapedWords: number }>;

export type SafetyTap = Readonly<{
  /** The sentences the model is allowed to voice for the generation that starts now. */
  allow(lines: readonly string[]): void;
  /** A piece of the output transcript, in the order it was spoken. */
  observe(chunk: string): SafetyVerdict;
  /** The model has finished (or been cut); the next transcript belongs to a new generation. */
  reset(): void;
  offPlanCount(): number;
  escapedWords(): number;
}>;

export function createSafetyTap(): SafetyTap {
  let allowed = '';
  let heard = '';
  let offPlan = 0;
  let escaped = 0;
  let cut = false;
  return {
    allow: (lines) => {
      allowed = normalise(lines.join(' '));
      heard = '';
      cut = false;
    },
    observe: (chunk) => {
      if (cut) return { kind: 'on_plan' };
      heard += chunk;
      const spoken = normalise(heard);
      if (spoken === '' || isOnPlan(allowed, spoken, chunk)) return { kind: 'on_plan' };
      cut = true;
      offPlan += 1;
      const escapedWords = words(spoken);
      escaped += escapedWords;
      return { kind: 'off_plan', heard: heard.trim(), escapedWords };
    },
    reset: () => {
      heard = '';
      cut = false;
    },
    offPlanCount: () => offPlan,
    escapedWords: () => escaped,
  };
}

/**
 * On-plan means the transcript so far reads as a contiguous run of the planned text.
 *
 * A chunk can end mid-word, so the last token is only held to account once the next chunk
 * shows where it ended; a plan with nothing in it allows nothing, which is what makes a
 * model that answers before calling `plan_next_move` an off-plan event rather than a gap.
 */
function isOnPlan(allowed: string, spoken: string, lastChunk: string): boolean {
  if (allowed === '') return false;
  if (allowed.includes(spoken)) return true;
  if (/[\s.!?,;:]$/.test(lastChunk)) return false;
  const lastSpace = spoken.lastIndexOf(' ');
  // A single unfinished word says nothing yet; a finished run before it must be on the plan.
  return lastSpace === -1 || allowed.includes(spoken.slice(0, lastSpace));
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(text: string): number {
  return text === '' ? 0 : text.split(' ').length;
}
