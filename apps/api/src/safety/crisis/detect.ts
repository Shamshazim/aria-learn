import type { CrisisCategory } from '@/safety/crisis/matrix';

export type SafetyInput = Readonly<{
  text: string;
  confidence?: number;
  alternatives?: readonly Readonly<{ text: string; confidence: number }>[];
}>;

export type CrisisDetection =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'crisis'; category: CrisisCategory; matchedText: string }>
  | Readonly<{ kind: 'uncertain'; category: CrisisCategory; matchedText: string }>;

const PATTERNS: readonly Readonly<{ category: CrisisCategory; expression: RegExp }>[] = [
  { category: 'self_harm', expression: /\b(kill|hurt) myself\b|\bdon'?t want to live\b/i },
  {
    category: 'immediate_danger',
    expression: /\b(in danger|someone is chasing me|has a weapon)\b/i,
  },
  {
    category: 'household_abuse',
    expression: /\b(mom|dad|parent|uncle|aunt|brother|sister).{0,28}\b(hit|hurt|touch)\b/i,
  },
  { category: 'general_distress', expression: /\b(i am scared|i feel hopeless|nobody cares)\b/i },
];

export function detectCrisis(input: SafetyInput): CrisisDetection {
  const direct = match(input.text);
  if (direct !== null)
    return input.confidence !== undefined && input.confidence < 0.75
      ? { kind: 'uncertain', ...direct }
      : { kind: 'crisis', ...direct };
  for (const alternative of input.alternatives ?? []) {
    const possible = match(alternative.text);
    if (possible !== null && alternative.confidence < 0.75) {
      return { kind: 'uncertain', ...possible };
    }
  }
  return { kind: 'none' };
}

function match(text: string): Readonly<{ category: CrisisCategory; matchedText: string }> | null {
  for (const pattern of PATTERNS) {
    if (pattern.expression.test(text)) return { category: pattern.category, matchedText: text };
  }
  return null;
}

export function containsSensitiveDisclosure(text: string): boolean {
  return (
    detectCrisis({ text }).kind !== 'none' ||
    /\b(my address|my school|my phone|full name is)\b/i.test(text)
  );
}

export function isUnsafeChildFacingText(text: string): boolean {
  return /\b(?:kill|suicide|weapon|sex|address|phone number|full name|photo|blood)\b/i.test(text);
}
