import { ALLOW_MARKER, ASSIGNMENT, PLACEHOLDERS, VENDOR_PATTERNS } from './patterns';

/**
 * The scan itself: text in, findings out, no file system and no process.
 *
 * Pure for the usual reason — every rule below is covered by a test that runs in
 * milliseconds — and for one specific to this tool: a scanner nobody can test is a scanner
 * everybody eventually disables.
 */
export type Finding = {
  file: string;
  line: number;
  rule: string;
  /** Never the value. A finding printed in a CI log must not leak what it found. */
  evidence: string;
};

/** How much of a match is safe to show: enough to find the line, not enough to use. */
const EVIDENCE_PREFIX = 4;

const CODE_LIKE = /[(){}<>`]/;

export function scanText(file: string, text: string): Finding[] {
  const findings: Finding[] = [];

  text.split(/\r?\n/).forEach((line, index) => {
    if (line.includes(ALLOW_MARKER)) return;
    findings.push(...scanLine(file, index + 1, line));
  });

  return findings;
}

function scanLine(file: string, line: number, text: string): Finding[] {
  const findings: Finding[] = [];

  for (const { name, pattern } of VENDOR_PATTERNS) {
    const match = pattern.exec(text);
    if (match) findings.push({ file, line, rule: name, evidence: redact(match[0]) });
  }

  // Only when no vendor rule fired: a matched Anthropic key assigned to ANTHROPIC_API_KEY is
  // one leak, and reporting it twice makes a report look like two.
  if (findings.length === 0) findings.push(...scanAssignments(file, line, text));

  return findings;
}

function scanAssignments(file: string, line: number, text: string): Finding[] {
  const findings: Finding[] = [];
  ASSIGNMENT.lastIndex = 0;

  for (const match of text.matchAll(ASSIGNMENT)) {
    const name = match[1];
    const value = match[2] ?? '';
    if (name !== undefined && looksSecret(value)) {
      findings.push({
        file,
        line,
        rule: `secret-shaped value assigned to ${name}`,
        evidence: redact(value),
      });
    }
  }

  return findings;
}

/**
 * The judgement call. Long, and mixed enough in character classes that a human did not type
 * it — which is what separates a generated credential from a word.
 */
export function looksSecret(value: string): boolean {
  if (PLACEHOLDERS.some((placeholder) => placeholder.test(value))) return false;
  if (value.length < 20) return false;
  // Source code, not a credential: `TOKEN: z.string().min(32)` is a schema, and no key
  // format in existence contains a bracket. Without this the scanner reports the very
  // declarations that keep the real values out of the repository.
  if (CODE_LIKE.test(value)) return false;

  // A connection string is judged on its password, not on its length: the URL itself is
  // long by nature and is not a secret without one.
  const url = /^[a-z][a-z0-9+.-]*:\/\/[^:@/]+:([^@/]+)@/i.exec(value);
  if (url) return looksSecret(url[1] ?? '');

  if (/^[a-z0-9]+([._/-][a-z0-9]+)*$/i.test(value) && !/\d{4,}/.test(value)) {
    // `some-long-dashed-word` and `a/path/like/this` are not credentials.
    return false;
  }

  return characterClasses(value) >= 3;
}

function characterClasses(value: string): number {
  return [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((set) => set.test(value)).length;
}

function redact(value: string): string {
  return `${value.slice(0, EVIDENCE_PREFIX)}… (${String(value.length)} chars)`;
}

/** One line per finding, in the shape a CI log is read in. */
export function formatFindings(findings: readonly Finding[]): string {
  return findings
    .map(
      (finding) => `${finding.file}:${String(finding.line)}  ${finding.rule}  ${finding.evidence}`,
    )
    .join('\n');
}
