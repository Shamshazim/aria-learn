import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { formatFindings, scanText } from '../secrets/scan';

import type { Finding } from '../secrets/scan';

/**
 * `npm run scan:secrets`.
 *
 * Scans every file git tracks. Tracked, not every file on disk: `.env` is gitignored and must
 * stay that way, and scanning it would only ever report the developer's own working copy.
 * What this protects is the repository, the CI log and the image layers built from it (X-01).
 *
 * Exits non-zero on the first finding, because a pipeline that continues past a leaked key is
 * a pipeline that publishes it.
 */
const MAX_BYTES = 2 * 1_024 * 1_024;

/** Extensions with no text to scan. Reading them wastes time and produces noise, not findings. */
const BINARY = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.ico',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.pdf',
  '.zip',
  '.gz',
  '.tar',
  '.mp3',
  '.mp4',
  '.wav',
  '.webm',
]);

/**
 * `legacy/` is frozen and is never built or shipped (CLAUDE.md), and `package-lock.json` is
 * generated. Neither can leak a key into a running system, and both are large.
 */
const SKIPPED_PATHS = [/^legacy\//, /^package-lock\.json$/];

function trackedFiles(): string[] {
  const output = execFileSync('git', ['ls-files', '-z'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1_024 * 1_024,
  });
  return output.split('\0').filter((file) => file !== '');
}

function scannable(file: string): boolean {
  if (BINARY.has(path.extname(file).toLowerCase())) return false;
  if (SKIPPED_PATHS.some((skipped) => skipped.test(file))) return false;

  try {
    return statSync(file).size <= MAX_BYTES;
  } catch {
    return false;
  }
}

function main(): void {
  const findings: Finding[] = [];

  for (const file of trackedFiles()) {
    if (!scannable(file)) continue;
    findings.push(...scanText(file, readFileSync(file, 'utf8')));
  }

  if (findings.length === 0) {
    process.stdout.write('No secrets found in tracked files.\n');
    return;
  }

  process.stderr.write(
    `${String(findings.length)} possible secret(s) in tracked files:\n\n${formatFindings(findings)}\n\n` +
      'Rotate anything real, remove it from the history, and keep values in the platform ' +
      "secrets manager. If a match is genuinely not a secret, mark the line 'pragma: allow-secret'.\n",
  );
  process.exitCode = 1;
}

main();
