import { ConfigError, loadConfig } from './env';

import type { AppConfig } from './env';

/**
 * Reading configuration from the process, in one place.
 *
 * Both entry points need it — the server and the migration CLI — and both must fail the same
 * way, with the same message naming the same variable. Extracted here so they cannot drift.
 */
const VERSION = process.env.npm_package_version ?? '0.0.0';

export function readConfig(): AppConfig {
  return loadConfig(process.env, VERSION);
}

/**
 * For an entry point that has nothing sensible to do with a configuration error. Writes to
 * stderr deliberately rather than to the logger: configuration failed, so the logger's own
 * settings are exactly what cannot be trusted yet.
 */
export function readConfigOrExit(): AppConfig {
  try {
    return readConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}
