/**
 * A blank environment variable means the same as an absent one.
 *
 * `.env.example` documents every key the workspace reads, most of them with nothing after the
 * `=`, and the README's first instruction is to copy the file whole. `process.loadEnvFile`
 * turns `KEY=` into an empty string, so an optional variable arrived at the schema as present
 * and invalid rather than missing: `cp .env.example .env && npm run dev` failed boot naming ten
 * variables nobody had been asked to fill in — "expected string to have >=32 characters" for a
 * token that is optional in development.
 *
 * A shell already reads it this way. `FOO= npm start` is how you say "not set", not "set to the
 * empty string", and configuration should not disagree with the thing that supplies it.
 *
 * Applied where the environment is parsed rather than to `process.env` itself: rewriting the
 * process's own environment underneath everything else that might read it is a larger promise
 * than this needs to make.
 */
export function withoutBlanks(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );
}
