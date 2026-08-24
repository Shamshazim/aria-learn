import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * One test runner for the whole repo.
 *
 * Vitest 4 removed `vitest.workspace.ts` in favour of `projects` here; the shape the ticket
 * asked for is unchanged. `api` and `shared` run in Node, and `apps/web` gets its own jsdom
 * environment because only it renders components (P0-05).
 *
 * `legacy/` is excluded explicitly. Without it Vitest discovers and executes the frozen
 * Electron tests, which AGENT-INSTRUCTIONS §2 forbids.
 */
const EXCLUDED = ['**/node_modules/**', '**/dist/**', 'legacy/**'];

const apiSrc = fileURLToPath(new URL('./apps/api/src', import.meta.url));
const webSrc = fileURLToPath(new URL('./apps/web/src', import.meta.url));

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['apps/web/src/features/session/model/session-machine.ts'],
      thresholds: { branches: 100 },
    },
    // The scaffold ships no tests of its own; the tickets it unblocks add the first ones.
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'shared',
          root: './packages/shared',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: EXCLUDED,
        },
      },
      {
        test: {
          name: 'api',
          root: './apps/api',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: EXCLUDED,
        },
        // Vitest does not read tsconfig `paths`, so the `@/*` alias each app declares has to
        // be repeated here or its tests cannot resolve their own imports (P0-03).
        resolve: { alias: { '@': apiSrc } },
      },
      {
        test: {
          // Everything that needs a real PostgreSQL, kept in its own project and its own
          // directory. `src/**` tests touch no I/O and run anywhere; these need a database,
          // take longer, and skip themselves when DATABASE_URL is absent outside CI.
          name: 'api-db',
          root: './apps/api',
          environment: 'node',
          include: ['test/**/*.test.ts'],
          exclude: EXCLUDED,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
        resolve: { alias: { '@': apiSrc } },
      },
      {
        test: {
          name: 'web',
          root: './apps/web',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: EXCLUDED,
          setupFiles: ['./src/test/setup.ts'],
        },
        resolve: { alias: { '@': webSrc } },
      },
    ],
  },
});
