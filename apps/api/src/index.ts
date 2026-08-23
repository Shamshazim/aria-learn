import { start } from '@/server';

/**
 * The executable entry point. It does one thing, so `server.ts` stays importable by a test
 * without a socket being opened as a side effect.
 */
start();
