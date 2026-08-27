import { cli, ServerOptions } from '@livekit/agents';

import { readVoiceWorkerConfig } from '@/config';
import { loadRepoEnvFile } from '@/dotenv';

// Before the schema reads it: the worker is started from its own package directory, so the
// file at the repo root is not something `process.env` would have on its own.
loadRepoEnvFile();

const config = readVoiceWorkerConfig(process.env);

cli.runApp(
  new ServerOptions({
    agent: new URL('./agent.ts', import.meta.url).pathname,
    wsURL: config.livekitUrl,
    apiKey: config.livekitApiKey,
    apiSecret: config.livekitApiSecret,
  }),
);
