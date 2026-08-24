import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createScriptedTutor, runTutoringGoldenSet } from '@/testing/tutoring';

const SCENARIO_DIRECTORY = fileURLToPath(
  new URL('../../../../../dev-docs/golden/tutoring/scenarios/', import.meta.url),
);

describe('runTutoringGoldenSet', () => {
  it('writes one Markdown transcript per scenario and a JSON invariant report', async () => {
    const outputDirectory = await mkdtemp(path.join(tmpdir(), 'aria-tutoring-golden-'));
    try {
      const createdFor: string[] = [];
      const result = await runTutoringGoldenSet({
        scenarioDirectory: SCENARIO_DIRECTORY,
        outputDirectory,
        tutorFactory: (scenario) => {
          createdFor.push(scenario.id);
          return createScriptedTutor(scenario);
        },
      });
      const filenames = (await readdir(outputDirectory)).sort();
      const reportInput: unknown = JSON.parse(
        await readFile(path.join(outputDirectory, 'invariant-report.json'), 'utf8'),
      );
      const report = z
        .object({ passed: z.boolean(), scenarios: z.array(z.unknown()).length(8) })
        .parse(reportInput);

      expect(result.passed).toBe(true);
      expect(createdFor).toHaveLength(8);
      expect(report.passed).toBe(true);
      expect(filenames.filter((filename) => filename.endsWith('.md'))).toHaveLength(8);
      expect(filenames).toContain('invariant-report.json');
    } finally {
      await rm(outputDirectory, { recursive: true });
    }
  });
});
