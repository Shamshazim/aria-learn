import type { IntentHints, IntentResult } from './intent.types';

/**
 * Deterministic first-pass intent rules (P2H-05). Pure and shared by both channels so a typed
 * "I have a cat" and a spoken one produce the same intent. A model second pass can refine an
 * `ANSWER` with low confidence later; the rules alone already stop chat being graded wrong.
 */
const STOP =
  /\b(?:stop|i(?:'m| am) done|all done|quit|no more|i want to (?:stop|go|leave)|bye)\b/iu;
const CONFUSED =
  /\b(?:i (?:don'?t|do not) (?:get|understand|know)|confus\w*|what do you mean|i'?m lost|too hard|huh)\b/iu;
const QUESTION_START =
  /^(?:what|why|how|who|when|where|which|can|could|do|does|did|is|are|will|would|should)\b/iu;
const FIRST_PERSON = /\b(?:i|i'm|my|me|we|our|mine)\b/iu;

const NUMBER_WORDS: Readonly<Record<string, string>> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20',
};

export function classifyIntent(rawText: string, hints: IntentHints): IntentResult {
  const text = rawText.trim();
  if (STOP.test(text)) return matched('STOP_REQUEST', 'stop-words');
  if (CONFUSED.test(text)) return matched('CONFUSED', 'confusion-phrase');
  if (containsAnswer(text, hints.answerKey)) return matched('ANSWER', 'matches-answer-key');
  if (text.endsWith('?') || QUESTION_START.test(text)) return matched('QUESTION', 'question-form');
  if (looksLikeChat(text, hints)) return matched('CHAT', 'first-person-statement');
  return { intent: 'ANSWER', confidence: 0.6, matchedRule: null };
}

function matched(intent: IntentResult['intent'], rule: string): IntentResult {
  return { intent, confidence: 0.9, matchedRule: rule };
}

function containsAnswer(text: string, answerKey: string | null): boolean {
  if (answerKey === null) return false;
  const key = normalise(answerKey);
  const spoken = normalise(text);
  if (spoken === key) return true;
  const tokens = spoken.split(' ').map((token) => NUMBER_WORDS[token] ?? token);
  return tokens.includes(key) || tokens.join(' ').includes(` ${key} `);
}

function looksLikeChat(text: string, hints: IntentHints): boolean {
  if (hints.answerKey === null) return false;
  const words = text.split(/\s+/u).filter((word) => word !== '');
  return words.length >= 3 && FIRST_PERSON.test(text) && !/\d/u.test(text);
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}
