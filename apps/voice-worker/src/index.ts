import { cli, ServerOptions } from '@livekit/agents';

import { readVoiceWorkerConfig } from '@/config';

const config = readVoiceWorkerConfig(process.env);

cli.runApp(
  new ServerOptions({
    agent: new URL('./agent.ts', import.meta.url).pathname,
    wsURL: config.livekitUrl,
    apiKey: config.livekitApiKey,
    apiSecret: config.livekitApiSecret,
  }),
);
