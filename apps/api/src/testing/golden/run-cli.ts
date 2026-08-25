import { fileURLToPath } from 'node:url';

import { promptRegistry } from '@/ai/prompts/registry';
import { loadAiConfig } from '@/ai/provider';
import { formatGoldenReport } from '@/testing/golden/format';
import { createLiveGoldenSource } from '@/testing/golden/live-source';
import { loadGoldenItems } from '@/testing/golden/load';
import { runGoldenSet } from '@/testing/golden/runner';

const ITEMS_DIRECTORY = fileURLToPath(
  new URL('../../../../../dev-docs/golden/content/items', import.meta.url),
);

async function main(): Promise<void> {
  const endpointName = argument('--endpoint');
  if (endpointName === undefined)
    throw new Error('Usage: --endpoint <configured endpoint> [--json]');
  const config = loadAiConfig(process.env, { requiredEndpointNames: [endpointName] });
  const items = await loadGoldenItems(ITEMS_DIRECTORY);
  const report = await runGoldenSet({
    endpointName,
    promptVersion: promptRegistry['practice-item'].version,
    items,
    source: createLiveGoldenSource({
      config,
      endpointName,
      fetch: globalThis.fetch,
      now: Date.now,
    }),
  });
  process.stdout.write(
    process.argv.includes('--json')
      ? `${JSON.stringify(report, null, 2)}\n`
      : formatGoldenReport(report),
  );
  if (!report.passed) process.exitCode = 1;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
