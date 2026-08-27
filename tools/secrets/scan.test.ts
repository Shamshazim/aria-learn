import { describe, expect, it } from 'vitest';

import { looksSecret, scanText } from './scan';

/**
 * Every fixture below is assembled from pieces at runtime rather than written out, so this
 * file contains no string that looks like a credential — which is what lets the scanner run
 * over its own test suite without finding itself.
 */
const join = (...parts: readonly string[]): string => parts.join('');

const anthropic = join('sk-ant-', 'api03-', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6');
const aws = join('AKIA', 'ABCDEFGHIJKLMNOP');
const jwt = join('eyJ', 'hbGciOiJIUzI1NiJ9.', 'eyJ', 'zdWIiOiIxMjM0NSJ9.', 'dBjftJeZ4CVPmB92K27u');

describe('scanText', () => {
  it('finds a vendor key by shape and never prints it', () => {
    const findings = scanText('.env', `ANTHROPIC_API_KEY=${anthropic}`);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe('Anthropic API key');
    expect(findings[0]?.evidence).not.toContain(anthropic);
    expect(findings[0]?.evidence).toMatch(/^sk-a… \(\d+ chars\)$/);
  });

  it.each([
    ['an AWS access key id', `aws_access_key_id = "${aws}"`],
    ['a service-role JWT', `SUPABASE_SERVICE_ROLE_KEY: ${jwt}`],
    ['a private key block', '-----BEGIN RSA PRIVATE KEY-----'],
  ])('finds %s', (_label, line) => {
    expect(scanText('config.yml', line)).toHaveLength(1);
  });

  it('reports the line, so a rotation can start from a location', () => {
    const findings = scanText('a.env', ['# comment', '', `KEY=${aws}`].join('\n'));

    expect(findings[0]?.line).toBe(3);
  });

  it('reports a leaked key once, not once per rule that matches it', () => {
    expect(scanText('.env', `OPENAI_API_KEY=${anthropic}`)).toHaveLength(1);
  });

  // The template files are the reason this tool can be run at all: they list every variable
  // by name, and none of them may trip it.
  it.each([
    'DATABASE_URL=postgresql://aria:aria@localhost:5432/aria_dev',
    'STATUS_OPERATOR_TOKEN=',
    'ANTHROPIC_API_KEY=',
    'SUPABASE_SERVICE_ROLE_KEY=<from the project settings>',
    'IDENTITY_JWT_SECRET=${IDENTITY_JWT_SECRET}',
    'AI_DAILY_SPEND_CAP_USD=1.00',
    'STATUS_OPERATOR_TOKEN=changeme',
  ])('passes the placeholder %s', (line) => {
    expect(scanText('infra/environments/prod.env.example', line)).toEqual([]);
  });

  it('catches a vendor nobody wrote a pattern for, by the name it was assigned to', () => {
    const line = `LIVEKIT_API_SECRET=${join('Zx9', '$', 'Qw8!Er7#Ty6%Ui5^Op4&As3')}`;

    expect(scanText('.env', line)[0]?.rule).toMatch(/LIVEKIT_API_SECRET/);
  });

  it('honours an explicit allow marker, which a reviewer can see', () => {
    expect(scanText('fixture.ts', `const key = '${aws}'; // pragma: allow-secret`)).toEqual([]);
  });
});

describe('looksSecret', () => {
  it.each([
    ['short', 'hunter2'],
    ['a dashed word', 'some-long-dashed-identifier'],
    ['a path', 'apps/api/src/db/migrations'],
    ['a number', '31536000'],
    ['a localhost url', 'postgresql://aria:aria@localhost:5432/aria_dev'],
    ['a schema declaration', 'z.string().min(32).max(512).optional()'],
  ])('says no to %s', (_label, value) => {
    expect(looksSecret(value)).toBe(false);
  });

  it.each([
    ['a generated key', join('k3J', '#', 'x9Lm2Qp7Rt4Wz8Yb1Nc6')],
    [
      'a url with a generated password',
      'postgresql://aria:k3J' + '#' + 'x9Lm2Qp7Rt4Wz8Yb1Nc6@db/aria',
    ],
  ])('says yes to %s', (_label, value) => {
    expect(looksSecret(value)).toBe(true);
  });
});
