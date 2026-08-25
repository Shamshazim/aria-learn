/**
 * A child volunteering something about themselves that must not be graded, stored or sent to
 * a model vendor (P2H-05).
 *
 * These are not the privacy scrubber's rules. The scrubber redacts identifiers on their way
 * *out* to a vendor; this decides what Aria *does* when a child offers one — which is to
 * deflect warmly and keep going, and to store nothing but a marker.
 *
 * The patterns are deliberately narrow. A false positive costs a child one deflection they
 * did not need; a false negative writes a home address into a session log.
 */
export type PersonalInfoRule = Readonly<{ name: string; pattern: RegExp }>;

export const PERSONAL_INFO_PATTERNS: readonly PersonalInfoRule[] = [
  {
    name: 'full-name',
    pattern: /\bmy\s+(?:full\s+|last\s+|family\s+)?name\s+is\b/iu,
  },
  { name: 'surname', pattern: /\bmy\s+(?:surname|last name)\b/iu },
  {
    name: 'address',
    pattern:
      /\b(?:i\s+live\s+(?:at|on|in\s+a\s+house)|my\s+(?:address|house|street)\s+is|we\s+live\s+at)\b/iu,
  },
  {
    name: 'street-address',
    pattern:
      /\b\d{1,6}\s+[\p{L}'-]+(?:\s+[\p{L}'-]+)?\s+(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|court|ct|way)\b/iu,
  },
  { name: 'phone', pattern: /(?<!\d)(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}(?!\d)/u },
  { name: 'phone-offer', pattern: /\b(?:my|our)\s+(?:phone\s+)?number\s+is\b/iu },
  { name: 'email', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu },
  {
    name: 'school',
    pattern:
      /\b(?:i\s+go\s+to|my\s+school\s+is)\s+[\p{L}'-]+(?:\s+[\p{L}'-]+)*\s*(?:school|academy)\b/iu,
  },
  { name: 'school-plain', pattern: /\bmy\s+school\s+is\s+called\b/iu },
];
