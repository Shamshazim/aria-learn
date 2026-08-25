import type { BridgeIntent } from './types';

const RULES: readonly Readonly<{ intent: BridgeIntent; pattern: RegExp }>[] = [
  { intent: 'leaving', pattern: /\b(got to go|have to go|mom is calling|dad is calling)\b/iu },
  { intent: 'stuck', pattern: /\b(i do not know|i don't know|do not get|don't get|help)\b/iu },
  { intent: 'request', pattern: /\b(tell me|can we|i want)\b/iu },
  { intent: 'question', pattern: /\?\s*$|^(why|what|how|when|where|who)\b/iu },
];

export function classifyBridgeByRule(transcript: string): Readonly<{
  intent: BridgeIntent;
  confidence: number;
}> {
  const text = transcript.trim();
  if (text.length === 0) return { intent: 'unclear', confidence: 1 };
  const match = RULES.find((rule) => rule.pattern.test(text));
  if (match !== undefined) return { intent: match.intent, confidence: 0.95 };
  return { intent: 'answer', confidence: 0.7 };
}

export function mayPlayBridge(
  input: Readonly<{
    interrupted: boolean;
    contentReady: boolean;
    assetApproved: boolean;
  }>,
): boolean {
  return !input.interrupted && !input.contentReady && input.assetApproved;
}

export function bridgeTextIsNonCommittal(text: string): boolean {
  return !/\b(correct|incorrect|right|wrong|yes|no)\b/iu.test(text);
}
