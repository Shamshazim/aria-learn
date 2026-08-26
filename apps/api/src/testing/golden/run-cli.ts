import { fileURLToPath } from 'node:url';

import { promptRegistry } from '@/ai/prompts/registry';
import { loadAiConfig } from '@/ai/provider';
import { formatGoldenReport } from '@/testing/golden/format';
import { createGeneratorGoldenSource } from '@/testing/golden/generator-source';
import { createLiveGoldenSource } from '@/testing/golden/live-source';
import { loadGoldenItems } from '@/testing/golden/load';
import { runGoldenSet } from '@/testing/golden/runner';
import type { GoldenItem, GoldenSource } from '@/testing/golden/types';

const ITEMS_DIRECTORY = fileURLToPath(
  new URL('../../../../../dev-docs/golden/content/items', import.meta.url),
);

const USAGE = 'Usage: --endpoint <configured endpoint> [--json] | --generator-only [--json]';

/**
 * `npm run golden:content -w @aria/api -- --endpoint <name>`, or `-- --generator-only`.
 *
 * P2H-10 added cases that need no model, and `--generator-only` is what makes them runnable on
 * their own: no endpoint, no key, no cost, and it still exercises the checker, the option rules
 * and the readability bar. A reviewer with no provider configured can run that half today,
 * which is the half this ticket added.
 */
async function main(): Promise<void> {
  const generatorOnly = process.argv.includes('--generator-only');
  const endpointName = argument('--endpoint');
  if (endpointName === undefined && !generatorOnly) throw new Error(USAGE);
  const all = await loadGoldenItems(ITEMS_DIRECTORY);
  const items = generatorOnly ? all.filter((item) => item.origin === 'generator') : all;
  const report = await runGoldenSet({
    endpointName: endpointName ?? 'generator',
    promptVersion: promptRegistry['practice-item'].version,
    items,
    source: modelSource(endpointName),
    generator: createGeneratorGoldenSource({ now: Date.now }),
  });
  process.stdout.write(
    process.argv.includes('--json')
      ? `${JSON.stringify(report, null, 2)}\n`
      : formatGoldenReport(report),
  );
  if (!report.passed) process.exitCode = 1;
}

/** Configuration is read only when a model case will actually be run. */
function modelSource(endpointName: string | undefined): GoldenSource {
  if (endpointName === undefined) {
    return {
      generate: (item: GoldenItem) => Promise.reject(new Error(`${item.id} needs an endpoint`)),
    };
  }
  return createLiveGoldenSource({
    config: loadAiConfig(process.env, { requiredEndpointNames: [endpointName] }),
    endpointName,
    fetch: globalThis.fetch,
    now: Date.now,
  });
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
