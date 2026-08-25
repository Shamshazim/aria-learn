import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

import { ENVIRONMENT_REFERENCE, aiConfigSchema, providerApiKeySchema } from './config.schema';

import type { AiConfig } from './config.schema';

/**
 * Loads `config/ai.yaml` once, at boot, and resolves keys for the endpoints that are routed.
 *
 * Only routed endpoints need a key (cloud-model-layer.md §4 rule 1), and a routed endpoint
 * without one stops the process here, naming the endpoint and the variable — never later, in
 * front of a child (rule 2). The resolved key lives only in the returned config; it is never
 * placed in an error message (rule 3).
 */
const DEFAULT_CONFIG_PATH = fileURLToPath(new URL('../../../config/ai.yaml', import.meta.url));
const MAX_CONFIG_BYTES = 64 * 1_024;
const CONFIG_SIZE_ERROR = `AI configuration must not exceed ${String(MAX_CONFIG_BYTES)} bytes`;

export type LoadAiConfigOptions = {
  filePath?: string;
  requiredEndpointNames?: readonly string[];
};

/** Boot-time only, like `ConfigError`: it never reaches a client, so it is not an AppError. */
export class AiConfigError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'AiConfigError';
  }
}

export function loadAiConfig(env: NodeJS.ProcessEnv, options: LoadAiConfigOptions = {}): AiConfig {
  const filePath = options.filePath ?? DEFAULT_CONFIG_PATH;
  const config = parseConfig(readConfigFile(filePath));

  return resolveRequiredKeys(config, env, options.requiredEndpointNames ?? []);
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
    throw new AiConfigError(`AI configuration file could not be read: ${filePath}`, error);
  }
}

function parseConfig(source: string): AiConfig {
  let input: unknown;
  try {
    input = parse(source);
  } catch (error) {
    throw new AiConfigError('AI configuration YAML could not be parsed', error);
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

function resolveRequiredKeys(
  config: AiConfig,
  env: NodeJS.ProcessEnv,
  additionalNames: readonly string[],
): AiConfig {
  const endpointNames = new Set(
    Object.values(config.app.ai.routing).flatMap((route) =>
      route.fallback === undefined ? [route.endpoint] : [route.endpoint, route.fallback],
    ),
  );
  for (const endpointName of additionalNames) endpointNames.add(endpointName);
  const endpoints = { ...config.app.ai.endpoints };

  for (const endpointName of endpointNames) {
    const endpoint = endpoints[endpointName];
    if (endpoint === undefined) {
      throw new AiConfigError(`AI endpoint "${endpointName}" is required but not configured`);
    }

    const variableName = ENVIRONMENT_REFERENCE.exec(endpoint['api-key'] ?? '')?.[1];
    if (variableName === undefined) {
      throw new AiConfigError(`AI endpoint "${endpointName}" is routed but has no api-key`);
    }

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
