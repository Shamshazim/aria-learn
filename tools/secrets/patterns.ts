/**
 * What a leaked credential looks like.
 *
 * Data, not logic, so adding a vendor is one line here and nothing else (CODE-STANDARDS §4).
 * Two kinds of rule live in this file and they fail differently on purpose:
 *
 *   * A **vendor pattern** is a shape only a real key has. It fires on sight.
 *   * The **assignment rule** catches the vendor nobody added a pattern for: a variable whose
 *     name says "secret" holding a value that looks like one. It has to judge, so it judges
 *     conservatively — a placeholder, a localhost password and a short word all pass.
 *
 * Neither is a substitute for the platform secrets manager. They are the net under it.
 */
export type SecretPattern = {
  /** Named so a report tells an engineer which key to rotate, not merely that one leaked. */
  name: string;
  pattern: RegExp;
};

export const VENDOR_PATTERNS: readonly SecretPattern[] = [
  { name: 'Anthropic API key', pattern: /sk-ant-[a-z0-9-]{2,}-[A-Za-z0-9_-]{24,}/ },
  // The lookahead keeps an Anthropic key from matching here too: one leaked credential
  // must be one finding, or a report's count stops meaning anything.
  { name: 'OpenAI API key', pattern: /sk-(?!ant-)(proj-)?[A-Za-z0-9_-]{32,}/ },
  { name: 'Groq API key', pattern: /gsk_[A-Za-z0-9]{40,}/ },
  { name: 'Supabase secret key', pattern: /sb_secret_[A-Za-z0-9_-]{20,}/ },
  { name: 'Supabase publishable key', pattern: /sb_publishable_[A-Za-z0-9_-]{20,}/ },
  // A service-role JWT is the one Supabase credential that bypasses row-level security.
  {
    name: 'JSON Web Token',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  },
  { name: 'AWS access key id', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'Google API key', pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'GitHub token', pattern: /gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,}/ },
  { name: 'Slack token', pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'Stripe live key', pattern: /[sr]k_live_[A-Za-z0-9]{20,}/ },
  { name: 'Private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

/** `NAME=value`, `NAME: value`, `"NAME": "value"` — every way a config file writes one. */
export const ASSIGNMENT =
  /["']?([A-Za-z_][A-Za-z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|CREDENTIALS))["']?\s*[:=]\s*["']?([^"'\s,]+)["']?/g;

/**
 * A line carrying this is not reported. It exists for the file that has to *contain* a
 * key-shaped string — a fixture, a piece of documentation — and it is deliberately visible in
 * a diff, because silencing a secret scanner is a thing a reviewer should see someone do.
 */
export const ALLOW_MARKER = 'pragma: allow-secret';

/**
 * Values that are obviously not credentials. A template is worth nothing if filling it in
 * with the word `changeme` trips the scanner, and a developer whose local Postgres password
 * is `aria` is not leaking anything.
 */
export const PLACEHOLDERS: readonly RegExp[] = [
  /^$/,
  /^["']{0,2}$/,
  /^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?$/, // ${VAR} — a reference, not a value
  /^<.*>$/, // <your-key-here>
  /^(changeme|change_me|placeholder|dummy|example|sample|test|todo|tbd|none|null|unset)$/i,
  /^x+$/i,
  /^\.{3,}$/,
  /^(aria|postgres|password|secret|localhost)$/i,
  /^(true|false|\d+(\.\d+)?)$/,
];
