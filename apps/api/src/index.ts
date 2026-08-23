import { start } from '@/server';

/**
 * The executable entry point. It does one thing, so `server.ts` stays importable by a test
 * without a socket being opened as a side effect.
 */
start().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
