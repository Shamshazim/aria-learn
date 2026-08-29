import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { AiConfigError, loadAiConfig } from '@/ai/provider';
import {
  KEYLESS_OPENAI_ENDPOINT,
  VALID_AI_CONFIG,
} from '@/ai/provider/__fixtures__/ai-config.fixtures';

const tempDirectories: string[] = [];
const TEST_ENV = { ANTHROPIC_API_KEY: 'test-key', GROQ_API_KEY: 'test-key' };

function writeConfig(contents: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'aria-ai-config-'));
  const filePath = join(directory, 'ai.yaml');
  tempDirectories.push(directory);
  writeFileSync(filePath, contents);
  return filePath;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true });
  }
});

describe('loadAiConfig loading', () => {
  it('wraps an unreadable config file in the named startup error', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aria-ai-config-'));
    tempDirectories.push(directory);

    const act = (): unknown => loadAiConfig({}, { filePath: join(directory, 'missing.yaml') });

    expect(act).toThrow(AiConfigError);
    expect(act).toThrow(/missing\.yaml/);
  });

  it('loads the checked-in Anthropic, OpenAI, and Groq-compatible endpoints', () => {
    const config = loadAiConfig(TEST_ENV);

    expect(config.app.ai.endpoints['groq-compatible']?.['json-via']).toBe('prompt');
    expect(config.app.ai.endpoints['groq-fast']?.['json-via']).toBe('prompt');
    expect(config.app.ai.endpoints['anthropic-sonnet']?.api).toBe('anthropic');
    expect(config.app.ai.endpoints['openai-gpt']?.api).toBe('openai');
    expect(config.app.ai.endpoints['groq-compatible']?.['base-url']).toBe(
      'https://api.groq.com/openai/v1',
    );
  });

  it('loads valid YAML and resolves routed endpoint keys from the environment', () => {
    const filePath = writeConfig(VALID_AI_CONFIG);

    const config = loadAiConfig(TEST_ENV, { filePath });

    expect(config.app.ai.endpoints.primary?.['api-key']).toBe('test-key');
  });

  it('rejects a missing routed key and names the endpoint and environment variable', () => {
    const filePath = writeConfig(VALID_AI_CONFIG);
    const act = (): unknown => loadAiConfig({}, { filePath });

    expect(act).toThrow(AiConfigError);
    expect(act).toThrow(/primary.*ANTHROPIC_API_KEY/);
  });

  it('does not require the key for an unreferenced endpoint', () => {
    const filePath = writeConfig(`${VALID_AI_CONFIG}${KEYLESS_OPENAI_ENDPOINT}`);

    expect(() => loadAiConfig(TEST_ENV, { filePath })).not.toThrow();
  });

  it('resolves an explicitly selected evaluation endpoint', () => {
    const dormant = KEYLESS_OPENAI_ENDPOINT.replace(
      '        model: gpt-5',
      '        api-key: ${OPENAI_API_KEY}\n        model: gpt-5',
    );
    const filePath = writeConfig(`${VALID_AI_CONFIG}${dormant}`);

    const config = loadAiConfig(
      { ...TEST_ENV, OPENAI_API_KEY: 'evaluation-key' },
      {
        filePath,
        requiredEndpointNames: ['dormant'],
      },
    );

    expect(config.app.ai.endpoints.dormant?.['api-key']).toBe('evaluation-key');
  });
});

describe('loadAiConfig routed endpoints', () => {
  it('requires the key for a configured fallback endpoint', () => {
    const routedFallback = VALID_AI_CONFIG.replace(
      'TEACH: { endpoint: primary }',
      'TEACH: { endpoint: primary, fallback: fallback }',
    );
    const filePath = writeConfig(`${routedFallback}
      fallback:
        api: openai
        base-url: https://api.openai.com/v1
        api-key: \${OPENAI_API_KEY}
        model: gpt-5
        max-tokens: 2048
        timeout-seconds: 60
        cost-per-mtok-in: 1.25
        cost-per-mtok-out: 10
`);

    expect(() => loadAiConfig(TEST_ENV, { filePath })).toThrow(/fallback.*OPENAI_API_KEY/);
  });

  it('rejects a routed endpoint that has no api-key, naming the endpoint', () => {
    const filePath = writeConfig(
      `${VALID_AI_CONFIG.replace('FAST: { endpoint: primary }', 'FAST: { endpoint: dormant }')}${KEYLESS_OPENAI_ENDPOINT}`,
    );

    expect(() => loadAiConfig(TEST_ENV, { filePath })).toThrow(
      /"dormant" is routed but has no api-key/,
    );
  });

  it('never puts the resolved key into an error message', () => {
    const filePath = writeConfig(
      VALID_AI_CONFIG.replace('cost-per-mtok-out: 15', 'cost-per-mtok-out: -1'),
    );
    const env = { ANTHROPIC_API_KEY: 'sk-super-secret' };

    expect(() => loadAiConfig(env, { filePath })).toThrow(AiConfigError);
    expect(() => loadAiConfig(env, { filePath })).not.toThrow(/sk-super-secret/);
  });

  it('rejects a route that names an endpoint which is not configured', () => {
    const filePath = writeConfig(
      VALID_AI_CONFIG.replaceAll('endpoint: primary', 'endpoint: missing'),
    );

    expect(() => loadAiConfig(TEST_ENV, { filePath })).toThrow(/routing\.TEACH\.endpoint.*missing/);
  });
});

describe('loadAiConfig schema validation', () => {
  it('rejects an unknown endpoint API with a readable path', () => {
    const filePath = writeConfig(VALID_AI_CONFIG.replace('api: anthropic', 'api: unknown'));
    const act = (): unknown => loadAiConfig(TEST_ENV, { filePath });

    expect(act).toThrow(AiConfigError);
    expect(act).toThrow(/app\.ai\.endpoints\.primary\.api: Invalid option/);
  });

  it('rejects a negative input-token cost', () => {
    const filePath = writeConfig(
      VALID_AI_CONFIG.replace('cost-per-mtok-in: 3', 'cost-per-mtok-in: -1'),
    );

    expect(() => loadAiConfig(TEST_ENV, { filePath })).toThrow(
      /app\.ai\.endpoints\.primary\.cost-per-mtok-in/,
    );
  });

  it('rejects an endpoint with no model', () => {
    const filePath = writeConfig(VALID_AI_CONFIG.replace('        model: claude-sonnet\n', ''));

    expect(() => loadAiConfig(TEST_ENV, { filePath })).toThrow(
      /app\.ai\.endpoints\.primary\.model/,
    );
  });

  it('rejects a malformed endpoint URL', () => {
    const filePath = writeConfig(VALID_AI_CONFIG.replace('https://api.anthropic.com', 'not-a-url'));

    expect(() => loadAiConfig(TEST_ENV, { filePath })).toThrow(
      /app\.ai\.endpoints\.primary\.base-url/,
    );
  });

  it('rejects a literal API key in the YAML file', () => {
    const filePath = writeConfig(VALID_AI_CONFIG.replace('${ANTHROPIC_API_KEY}', 'secret-in-file'));

    expect(() => loadAiConfig(TEST_ENV, { filePath })).toThrow(
      /app\.ai\.endpoints\.primary\.api-key: must be an environment reference/,
    );
  });
});
