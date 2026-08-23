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

export default defineConfig({
  test: {
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
      },
      {
        test: {
          name: 'web',
          root: './apps/web',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: EXCLUDED,
        },
      },
    ],
  },
});
