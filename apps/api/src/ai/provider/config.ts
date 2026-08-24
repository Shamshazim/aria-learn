import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

import { aiConfigSchema, providerApiKeySchema } from '@/ai/provider/config.schema';
import type { AiConfig } from '@/ai/provider/config.schema';

const DEFAULT_CONFIG_PATH = fileURLToPath(new URL('../../../config/ai.yaml', import.meta.url));
const ENVIRONMENT_REFERENCE = /^\$\{([A-Z_][A-Z0-9_]*)\}$/;
const MAX_CONFIG_BYTES = 64 * 1_024;
const CONFIG_SIZE_ERROR = `AI configuration must not exceed ${String(MAX_CONFIG_BYTES)} bytes`;

export type LoadAiConfigOptions = {
  filePath?: string;
  env?: NodeJS.ProcessEnv;
};

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiConfigError';
  }
}

export function loadAiConfig(options: LoadAiConfigOptions = {}): AiConfig {
  const source = readConfigFile(options.filePath ?? DEFAULT_CONFIG_PATH);
  const config = parseConfig(source);

  return resolveRoutedKeys(config, options.env ?? process.env);
}

function readConfigFile(filePath: string): string {
  try {
    if (statSync(filePath).size > MAX_CONFIG_BYTES) {
      throw new AiConfigError(CONFIG_SIZE_ERROR);
    }
    const source = readFileSync(filePath, 'utf8');
    if (Buffer.byteLength(source) > MAX_CONFIG_BYTES) {
      throw new AiConfigError(CONFIG_SIZE_ERROR);
    }
    return source;
  } catch (error) {
    if (error instanceof AiConfigError) throw error;
    throw new AiConfigError('AI configuration file could not be read');
  }
}

function parseConfig(source: string): AiConfig {
  let input: unknown;
  try {
    input = parse(source);
  } catch {
    throw new AiConfigError('AI configuration YAML could not be parsed');
  }

  const parsed = aiConfigSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new AiConfigError(`Invalid AI configuration — ${details}`);
  }
  return parsed.data;
}

function resolveRoutedKeys(config: AiConfig, env: NodeJS.ProcessEnv): AiConfig {
  const endpointNames = new Set(
    Object.values(config.app.ai.routing).flatMap((route) =>
      route.fallback === undefined ? [route.endpoint] : [route.endpoint, route.fallback],
    ),
  );
  const endpoints = { ...config.app.ai.endpoints };

  for (const endpointName of endpointNames) {
    const endpoint = endpoints[endpointName];
    if (endpoint === undefined) continue;

    const variableName = ENVIRONMENT_REFERENCE.exec(endpoint['api-key'])?.[1];
    if (variableName === undefined) continue;

    const keyResult = providerApiKeySchema.safeParse(env[variableName]);
    if (!keyResult.success) {
      throw new AiConfigError(
        `AI endpoint "${endpointName}" requires environment variable ${variableName}`,
      );
    }
    endpoints[endpointName] = { ...endpoint, 'api-key': keyResult.data };
  }

  return { app: { ai: { ...config.app.ai, endpoints } } };
}
