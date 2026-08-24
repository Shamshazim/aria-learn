import type { RawIdentifiers } from '@/privacy/types';

export type IdentifierKind = 'address' | 'birthdate' | 'email' | 'full_name' | 'phone' | 'school';

export type IdentifierRule = Readonly<{
  kind: IdentifierKind;
  pattern: RegExp;
}>;

const GENERIC_RULES: readonly IdentifierRule[] = [
  {
    kind: 'email',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
  },
  {
    kind: 'full_name',
    pattern:
      /\bmy\s+(?:full\s+)?name\s+is\s+[\p{L}'-]+(?:\s+[\p{L}'-]+){0,3}?(?=[,.!?;]|$|\s+(?:and|but|because)\b)/giu,
  },
  {
    kind: 'phone',
    pattern: /(?<!\d)(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}(?!\d)/g,
  },
  {
    kind: 'phone',
    pattern: /(?<!\d)\d{10}(?!\d)/g,
  },
  {
    kind: 'phone',
    pattern: /(?<!\d)\+\d{1,3}(?:[\s.-]\d{1,4}){2,5}(?!\d)/g,
  },
  {
    kind: 'address',
    pattern:
      /\b\d{1,6}[A-Z]?\s+(?:[\p{L}\d.'-]+\s+){0,5}(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|court|ct|way|parkway|pkwy)\b/giu,
  },
  {
    kind: 'school',
    pattern:
      /\b(?:[A-Z][\p{L}'&.-]*\s+){1,5}(?:(?:Elementary|Middle|High|Primary|Secondary)\s+)?(?:School|Academy)\b/gu,
  },
  {
    kind: 'school',
    pattern:
      /\b[\p{L}\d&'.-]+\s+(?:elementary|middle|high|primary|secondary)\s+(?:school|academy)\b/giu,
  },
  {
    kind: 'birthdate',
    pattern: /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:19|20)\d{2}\b/g,
  },
  {
    kind: 'birthdate',
    pattern:
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:[1-9]|[12]\d|3[01]),\s+(?:19|20)\d{2}\b/giu,
  },
];

function literalRule(kind: IdentifierKind, value: string): IdentifierRule {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    kind,
    pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu'),
  };
}

function fullNameRules(fullName: string | undefined): readonly IdentifierRule[] {
  if (fullName === undefined || fullName.trim() === '') return [];

  const name = fullName.trim();
  const parts = name.split(/\s+/u).filter((part) => part.length >= 2);
  return [name, ...parts].map((value) => literalRule('full_name', value));
}

export function createIdentifierRules(identifiers: RawIdentifiers): readonly IdentifierRule[] {
  const known: readonly [IdentifierKind, string | undefined][] = [
    ['school', identifiers.school],
    ['address', identifiers.address],
    ['email', identifiers.parentEmail],
    ['phone', identifiers.phone],
    ['birthdate', identifiers.exactBirthdate],
  ];
  const knownRules = known.flatMap(([kind, value]) =>
    value === undefined || value.trim() === '' ? [] : [literalRule(kind, value.trim())],
  );

  return [...fullNameRules(identifiers.fullName), ...knownRules, ...GENERIC_RULES];
}
