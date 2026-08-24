import type { IdentifierRule } from '@/privacy/rules/identifiers';

/** Fixed labels are deterministic for the vendor and reveal no reversible lookup value. */
export function redactText(value: string, rules: readonly IdentifierRule[]): string {
  return rules
    .reduce((redacted, rule) => redacted.replace(rule.pattern, `[redacted:${rule.kind}]`), value)
    .trim();
}
