import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { AiConfigError, loadAiConfig } from '@/ai/provider';

const tempDirectories: string[] = [];
const VALID_AI_CONFIG = `
app:
  ai:
    routing:
      TEACH: { endpoint: primary }
      FAST: { endpoint: primary }
    endpoints:
      primary:
        api: anthropic
        base-url: https://api.anthropic.com
        api-key: \${ANTHROPIC_API_KEY}
        model: claude-sonnet
        max-tokens: 2048
        timeout-seconds: 60
        cost-per-mtok-in: 3
        cost-per-mtok-out: 15
`;

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

    expect(() => loadAiConfig({ filePath: join(directory, 'missing.yaml'), env: {} })).toThrow(
      AiConfigError,
    );
  });

  it('loads the checked-in Anthropic, OpenAI, and Groq-compatible endpoints', () => {
    const config = loadAiConfig({ env: { ANTHROPIC_API_KEY: 'test-key' } });

    expect(config.app.ai.endpoints['anthropic-sonnet']?.api).toBe('anthropic');
    expect(config.app.ai.endpoints['openai-gpt']?.api).toBe('openai');
    expect(config.app.ai.endpoints['groq-compatible']?.['base-url']).toBe(
      'https://api.groq.com/openai/v1',
    );
  });

  it('loads valid YAML and resolves routed endpoint keys from the environment', () => {
    const filePath = writeConfig(VALID_AI_CONFIG);

    const config = loadAiConfig({ filePath, env: { ANTHROPIC_API_KEY: 'test-key' } });

    expect(config.app.ai.endpoints.primary?.['api-key']).toBe('test-key');
  });

  it('rejects a missing routed key and names the endpoint and environment variable', () => {
    const filePath = writeConfig(VALID_AI_CONFIG);
    const act = (): unknown => loadAiConfig({ filePath, env: {} });

    expect(act).toThrow(AiConfigError);
    expect(act).toThrow(/primary.*ANTHROPIC_API_KEY/);
  });

  it('does not require the key for an unreferenced endpoint', () => {
    const filePath = writeConfig(`${VALID_AI_CONFIG}
      dormant:
        api: openai
        base-url: https://api.openai.com/v1
        api-key: \${OPENAI_API_KEY}
        model: gpt-5
        max-tokens: 2048
        timeout-seconds: 60
        cost-per-mtok-in: 1.25
        cost-per-mtok-out: 10
`);

    expect(() => loadAiConfig({ filePath, env: { ANTHROPIC_API_KEY: 'test-key' } })).not.toThrow();
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

    expect(() => loadAiConfig({ filePath, env: { ANTHROPIC_API_KEY: 'test-key' } })).toThrow(
      /fallback.*OPENAI_API_KEY/,
    );
  });

  it('rejects a route that names an endpoint which is not configured', () => {
    const filePath = writeConfig(
      VALID_AI_CONFIG.replaceAll('endpoint: primary', 'endpoint: missing'),
    );

    expect(() => loadAiConfig({ filePath, env: { ANTHROPIC_API_KEY: 'test-key' } })).toThrow(
      /routing\.TEACH\.endpoint.*missing/,
    );
  });
});

describe('loadAiConfig schema validation', () => {
  it('rejects an unknown endpoint API with a readable path', () => {
    const filePath = writeConfig(VALID_AI_CONFIG.replace('api: anthropic', 'api: unknown'));
    const act = (): unknown => loadAiConfig({ filePath, env: { ANTHROPIC_API_KEY: 'test-key' } });

    expect(act).toThrow(AiConfigError);
    expect(act).toThrow(/app\.ai\.endpoints\.primary\.api/);
  });

  it('rejects a negative input-token cost', () => {
    const filePath = writeConfig(
      VALID_AI_CONFIG.replace('cost-per-mtok-in: 3', 'cost-per-mtok-in: -1'),
    );

    expect(() => loadAiConfig({ filePath, env: { ANTHROPIC_API_KEY: 'test-key' } })).toThrow(
      /app\.ai\.endpoints\.primary\.cost-per-mtok-in/,
    );
  });

  it('rejects an endpoint with no model', () => {
    const filePath = writeConfig(VALID_AI_CONFIG.replace('        model: claude-sonnet\n', ''));

    expect(() => loadAiConfig({ filePath, env: { ANTHROPIC_API_KEY: 'test-key' } })).toThrow(
      /app\.ai\.endpoints\.primary\.model/,
    );
  });

  it('rejects a malformed endpoint URL', () => {
    const filePath = writeConfig(VALID_AI_CONFIG.replace('https://api.anthropic.com', 'not-a-url'));

    expect(() => loadAiConfig({ filePath, env: { ANTHROPIC_API_KEY: 'test-key' } })).toThrow(
      /app\.ai\.endpoints\.primary\.base-url/,
    );
  });

  it('rejects a literal API key in the YAML file', () => {
    const filePath = writeConfig(VALID_AI_CONFIG.replace('${ANTHROPIC_API_KEY}', 'secret-in-file'));

    expect(() => loadAiConfig({ filePath, env: { ANTHROPIC_API_KEY: 'test-key' } })).toThrow(
      /app\.ai\.endpoints\.primary\.api-key/,
    );
  });
});
