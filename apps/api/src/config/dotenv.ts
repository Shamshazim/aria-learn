import path from 'node:path';

/**
 * The repo's `.env`, loaded before configuration is read (P2H-12).
 *
 * Without this an entry point only sees what the shell exported, so running the API meant
 * `set -a; source .env; set +a` first — a step that is easy to forget and whose failure looks
 * like a configuration error rather than a missing step.
 *
 * Node does not override an existing variable when it loads a file, so a value exported in the
 * shell still wins over the file. That is the right precedence: the file is the default, and
 * `DATABASE_URL=... npm run dev` is how somebody overrides it for one run.
 *
 * The path is resolved from this module rather than from the working directory, because a
 * workspace script runs with `cwd` set to its own package and the file lives at the root.
 */
const REPO_ENV_FILE = path.join(import.meta.dirname, '../../../../.env');

export function loadRepoEnvFile(file: string = REPO_ENV_FILE): void {
  try {
    process.loadEnvFile(file);
  } catch {
    // No `.env`, or unreadable. The environment is then expected to carry the variables
    // already, and `loadConfig` is what says which one is missing.
  }
}
