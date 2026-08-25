import { describe, expect, it } from 'vitest';

import { ConfigError, loadConfig } from '@/config';

/**
 * Configuration must fail at boot, loudly, naming what is wrong. The alternative is failing
 * on the request that needs the missing value — in front of a child.
 */

/** The minimum a real environment must supply. Everything else has a defensible default. */
const REQUIRED = { DATABASE_URL: 'postgresql://aria:aria@localhost:5432/aria_dev' };

function env(overrides: Record<string, string> = {}): Record<string, string> {
  return { ...REQUIRED, ...overrides };
}

describe('loadConfig', () => {
  it('applies defaults so a minimal environment still boots in development', () => {
    const config = loadConfig(env(), '1.0.0');

    expect(config).toMatchObject({
      env: 'development',
      port: 3000,
      logLevel: 'info',
      corsOrigins: [],
      isProduction: false,
    });
  });

  it('coerces the port from its string environment value', () => {
    expect(loadConfig(env({ API_PORT: '8080' }), '1.0.0').port).toBe(8080);
  });

  it('rejects a port outside the valid range, naming the variable', () => {
    expect(() => loadConfig(env({ API_PORT: '70000' }), '1.0.0')).toThrow(ConfigError);
    expect(() => loadConfig(env({ API_PORT: '70000' }), '1.0.0')).toThrow(/API_PORT/);
  });

  it('rejects a non-numeric port rather than silently defaulting', () => {
    expect(() => loadConfig(env({ API_PORT: 'http' }), '1.0.0')).toThrow(/API_PORT/);
  });

  it('names every offending variable at once, not one per restart', () => {
    const act = (): unknown => loadConfig(env({ API_PORT: '-1', NODE_ENV: 'staging' }), '1.0.0');

    expect(act).toThrow(/API_PORT/);
    expect(act).toThrow(/NODE_ENV/);
  });

  it('splits and trims the CORS origin list', () => {
    const config = loadConfig(env({ CORS_ORIGINS: 'https://a.test, https://b.test ,' }), '1.0.0');

    expect(config.corsOrigins).toEqual(['https://a.test', 'https://b.test']);
  });

  it('treats production as production', () => {
    expect(
      loadConfig(
        env({
          NODE_ENV: 'production',
          STATUS_OPERATOR_TOKEN: 'x'.repeat(32),
          SAFEGUARDING_WEBHOOK_URL: 'https://safety.example.test/notify',
          SAFEGUARDING_WEBHOOK_TOKEN: 'y'.repeat(32),
        }),
        '1.0.0',
      ).isProduction,
    ).toBe(true);
  });

  it('requires a status operator token in production', () => {
    expect(() => loadConfig(env({ NODE_ENV: 'production' }), '1.0.0')).toThrow(
      /STATUS_OPERATOR_TOKEN/,
    );
  });

  it('bounds the per-student daily AI spend cap', () => {
    expect(loadConfig(env(), '1.0.0').aiDailySpendCapUsd).toBe(1);
    expect(loadConfig(env({ AI_DAILY_SPEND_CAP_USD: '0.75' }), '1.0.0').aiDailySpendCapUsd).toBe(
      0.75,
    );
    expect(() => loadConfig(env({ AI_DAILY_SPEND_CAP_USD: '0' }), '1.0.0')).toThrow(
      /AI_DAILY_SPEND_CAP_USD/,
    );
  });
});

/**
 * The database is not optional and never has a default. A service that starts without one
 * only discovers it on the first query, which is the trade this ticket exists to avoid.
 */
describe('loadConfig — database', () => {
  it('refuses to boot without a DATABASE_URL', () => {
    expect(() => loadConfig({}, '1.0.0')).toThrow(/DATABASE_URL/);
  });

  it('refuses a connection string for something other than PostgreSQL', () => {
    expect(() => loadConfig({ DATABASE_URL: 'mysql://localhost/aria' }, '1.0.0')).toThrow(
      /postgres/,
    );
  });

  it('accepts both postgres:// and postgresql://', () => {
    expect(loadConfig({ DATABASE_URL: 'postgres://localhost/aria' }, '1.0.0').database.url).toBe(
      'postgres://localhost/aria',
    );
  });

  it('sizes the pool from defaults that suit a single process', () => {
    expect(loadConfig(env(), '1.0.0').database).toMatchObject({
      poolMax: 10,
      idleTimeoutMs: 30_000,
      connectionTimeoutMs: 5_000,
      statementTimeoutMs: 10_000,
    });
  });

  it('coerces the pool knobs and rejects a size Postgres could not honour', () => {
    expect(loadConfig(env({ DB_POOL_MAX: '25' }), '1.0.0').database.poolMax).toBe(25);
    expect(() => loadConfig(env({ DB_POOL_MAX: '0' }), '1.0.0')).toThrow(/DB_POOL_MAX/);
  });
});
