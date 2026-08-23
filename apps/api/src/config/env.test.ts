import { describe, expect, it } from 'vitest';

import { ConfigError, loadConfig } from '@/config';

/**
 * Configuration must fail at boot, loudly, naming what is wrong. The alternative is failing
 * on the request that needs the missing value — in front of a child.
 */
describe('loadConfig', () => {
  it('applies defaults so a bare environment still boots in development', () => {
    const config = loadConfig({}, '1.0.0');

    expect(config).toMatchObject({
      env: 'development',
      port: 3000,
      logLevel: 'info',
      corsOrigins: [],
      isProduction: false,
    });
  });

  it('coerces the port from its string environment value', () => {
    expect(loadConfig({ API_PORT: '8080' }, '1.0.0').port).toBe(8080);
  });

  it('rejects a port outside the valid range, naming the variable', () => {
    expect(() => loadConfig({ API_PORT: '70000' }, '1.0.0')).toThrow(ConfigError);
    expect(() => loadConfig({ API_PORT: '70000' }, '1.0.0')).toThrow(/API_PORT/);
  });

  it('rejects a non-numeric port rather than silently defaulting', () => {
    expect(() => loadConfig({ API_PORT: 'http' }, '1.0.0')).toThrow(/API_PORT/);
  });

  it('names every offending variable at once, not one per restart', () => {
    const act = (): unknown => loadConfig({ API_PORT: '-1', NODE_ENV: 'staging' }, '1.0.0');

    expect(act).toThrow(/API_PORT/);
    expect(act).toThrow(/NODE_ENV/);
  });

  it('splits and trims the CORS origin list', () => {
    const config = loadConfig({ CORS_ORIGINS: 'https://a.test, https://b.test ,' }, '1.0.0');

    expect(config.corsOrigins).toEqual(['https://a.test', 'https://b.test']);
  });

  it('treats production as production', () => {
    expect(loadConfig({ NODE_ENV: 'production' }, '1.0.0').isProduction).toBe(true);
  });
});
