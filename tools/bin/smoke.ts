import {
  allPassed,
  checkApiOrigin,
  checkHealth,
  checkVersion,
  checkWebRoute,
  summarise,
} from '../deploy/smoke';

import type { SmokeCheck } from '../deploy/smoke';

/**
 * `npm run smoke -- --api <url> --web <url> [--version <v>]`.
 *
 * Runs after every deploy and gates it (X-01). It is deliberately small: four things that are
 * true of a working release and false of the ways a deploy actually breaks — an instance that
 * cannot reach its database, a rollout that silently kept the old image, a web build whose
 * SPA fallback is misconfigured, and a bundle pointing at the wrong environment's API.
 *
 * X-04 adds a synthetic tutoring session on top of this. This is the part that does not need
 * a child, a model budget or a voice provider to run.
 */
const TIMEOUT_MS = 15_000;
const ASSET_PATTERN = /(?:src|href)="(\/assets\/[^"]+\.js)"/g;

type Args = { api: string; web: string; version: string | undefined };

function parseArgs(argv: readonly string[]): Args {
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag?.startsWith('--') === true && value !== undefined) values.set(flag.slice(2), value);
  }

  const api = values.get('api');
  const web = values.get('web');
  if (api === undefined || web === undefined) {
    throw new Error('Usage: npm run smoke -- --api <url> --web <url> [--version <v>]');
  }

  return { api, web, version: values.get('version') };
}

async function get(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' });
}

async function apiChecks(base: string, version: string | undefined): Promise<SmokeCheck[]> {
  const response = await get(`${base}/api/v1/health`);
  const body: unknown = await response.json().catch(() => ({}));

  return [checkHealth(response.status, body), checkVersion(body, version)];
}

/** `/hello` rather than `/`: it is a client-side route, so it proves the SPA fallback. */
async function webChecks(base: string, apiOrigin: string): Promise<SmokeCheck[]> {
  const response = await get(`${base}/hello`);
  const html = await response.text();
  const assets = [...html.matchAll(ASSET_PATTERN)].map((match) => match[1] ?? '');

  const sources = await Promise.all(
    assets.map(async (asset) => (await get(`${base}${asset}`)).text()),
  );

  return [
    checkWebRoute(response.status, response.headers.get('content-type')),
    checkApiOrigin(html, sources, apiOrigin),
  ];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const checks = [
    ...(await apiChecks(args.api, args.version)),
    ...(await webChecks(args.web, args.api)),
  ];

  process.stdout.write(`${summarise(checks)}\n`);
  if (!allPassed(checks)) {
    process.stderr.write('\nSmoke checks failed. Roll back to the previous image tag.\n');
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
