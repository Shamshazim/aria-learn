import path from 'node:path';

/**
 * The repo's `.env`, loaded before this worker reads its configuration.
 *
 * A deliberate second copy of the API's `config/dotenv.ts` rather than a shared one. The
 * obvious home would be `@aria/shared`, but the web app imports that package into a browser
 * bundle, and `node:path` and `process.loadEnvFile` have no business being in it. Ten lines in
 * two composition roots is the cheaper mistake.
 *
 * Node does not override an existing variable when it loads a file, so a value exported in the
 * shell still wins: the file is the default, and `VOICE_REGION=eu npm run dev:voice` is how
 * somebody overrides it for one run.
 */
const REPO_ENV_FILE = path.join(import.meta.dirname, '../../../.env');

export function loadRepoEnvFile(file: string = REPO_ENV_FILE): void {
  try {
    process.loadEnvFile(file);
  } catch {
    // No `.env`, or unreadable. The environment is then expected to carry the variables
    // already, and the schema is what says which one is missing.
  }
}
