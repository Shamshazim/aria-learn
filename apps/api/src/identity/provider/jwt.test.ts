import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { AppError } from '@/errors';

import { createHs256Verifier } from './jwt';

/**
 * The verifier is the whole of Aria's trust in the vendor's signature, so these tests are
 * mostly about what it *refuses*: an unsigned token, a token signed with another key, a token
 * that says it uses another algorithm, and a token that has expired. Each of those is a real
 * attack, and each has to fail closed.
 */
const SECRET = 'a-test-signing-secret-that-is-long-enough-32';
const NOW = new Date('2026-08-24T12:00:00.000Z');

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(payload: object, options: { secret?: string; header?: object } = {}): string {
  const header = encode(options.header ?? { alg: 'HS256', typ: 'JWT' });
  const body = encode(payload);
  const signature = createHmac('sha256', options.secret ?? SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

const validClaims = {
  sub: 'provider-subject-1',
  session_id: 'provider-session-1',
  email: 'parent@example.com',
  aud: 'authenticated',
  iat: Math.floor(NOW.getTime() / 1000) - 60,
  exp: Math.floor(NOW.getTime() / 1000) + 900,
};

const verifier = createHs256Verifier({
  secret: SECRET,
  audience: 'authenticated',
  now: () => NOW,
});

describe('createHs256Verifier', () => {
  it('returns the subject, session and email of a correctly signed token', () => {
    expect(verifier.verify(sign(validClaims))).toEqual({
      subject: 'provider-subject-1',
      sessionId: 'provider-session-1',
      email: 'parent@example.com',
      expiresAt: new Date(validClaims.exp * 1000),
    });
  });

  const rejected: readonly (readonly [string, string])[] = [
    [
      'a token signed with another key',
      sign(validClaims, { secret: 'a-different-secret-value-32-chars' }),
    ],
    ['a token whose signature is truncated', sign(validClaims).slice(0, -4)],
    ['an unsigned token', `${encode({ alg: 'none' })}.${encode(validClaims)}.`],
    ['a token claiming another algorithm', sign(validClaims, { header: { alg: 'RS256' } })],
    ['a token that is not three parts', 'not.a.jwt.at.all'],
    ['a token with no session claim', sign({ ...validClaims, session_id: undefined })],
    ['a token for another audience', sign({ ...validClaims, aud: 'anon' })],
    ['an expired token', sign({ ...validClaims, exp: Math.floor(NOW.getTime() / 1000) - 3600 })],
  ];

  it.each(rejected)('rejects %s', (_name, token) => {
    expect(() => verifier.verify(token)).toThrow(AppError);
  });

  it('never tells the caller which claim failed', () => {
    try {
      verifier.verify(sign({ ...validClaims, exp: 1 }));
      expect.unreachable('an expired token must throw');
    } catch (error) {
      // The reason is in the log message; `safeMessage` is what a client sees.
      expect(error).toBeInstanceOf(AppError);
      if (!(error instanceof AppError)) return;
      expect(error.safeMessage).toBe('Please sign in again.');
      expect(error.safeMessage).not.toContain('expired');
    }
  });

  it('tolerates a small clock difference between Aria and the vendor', () => {
    const justExpired = { ...validClaims, exp: Math.floor(NOW.getTime() / 1000) - 5 };
    expect(() => verifier.verify(sign(justExpired))).not.toThrow();
  });

  it('rejects an issuer that does not match when one is configured', () => {
    const strict = createHs256Verifier({
      secret: SECRET,
      audience: 'authenticated',
      issuer: 'https://aria.example.supabase.co/auth/v1',
      now: () => NOW,
    });

    expect(() => strict.verify(sign(validClaims))).toThrow(AppError);
    expect(() =>
      strict.verify(sign({ ...validClaims, iss: 'https://aria.example.supabase.co/auth/v1' })),
    ).not.toThrow();
  });
});
