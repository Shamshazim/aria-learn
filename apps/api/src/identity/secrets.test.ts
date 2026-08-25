import { describe, expect, it } from 'vitest';

import {
  SECRET_KINDS,
  hashSecret,
  isWellFormedSecret,
  randomSecrets,
  secretMatches,
} from './secrets';

/**
 * These are the credentials a device and a child session are held together by. The properties
 * worth asserting are that they are unguessable, that they are namespaced so one cannot be
 * replayed as the other, and that the stored form is not the presented form.
 */
describe('opaque secrets', () => {
  it('issues a distinct secret every time', () => {
    const issued = new Set(
      Array.from({ length: 200 }, () => randomSecrets.issue(SECRET_KINDS.device)),
    );
    expect(issued.size).toBe(200);
  });

  it('namespaces each kind, so a device secret is not a session token', () => {
    const device = randomSecrets.issue(SECRET_KINDS.device);
    const session = randomSecrets.issue(SECRET_KINDS.childSession);

    expect(isWellFormedSecret(device, SECRET_KINDS.device)).toBe(true);
    expect(isWellFormedSecret(device, SECRET_KINDS.childSession)).toBe(false);
    expect(isWellFormedSecret(session, SECRET_KINDS.childSession)).toBe(true);
  });

  it('stores a digest rather than the secret', () => {
    const secret = randomSecrets.issue(SECRET_KINDS.device);
    const stored = hashSecret(secret);

    expect(stored).not.toContain(secret);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches a secret against its own digest and nothing else', () => {
    const secret = randomSecrets.issue(SECRET_KINDS.device);
    expect(secretMatches(secret, hashSecret(secret))).toBe(true);
    expect(secretMatches(secret, hashSecret(`${secret}x`))).toBe(false);
    expect(secretMatches(secret, 'not-a-digest')).toBe(false);
  });

  it.each(['', 'dev_', 'nope_aaaaaaaaaaaa', 'x'.repeat(200)])(
    'refuses the malformed secret %j before any lookup',
    (value) => {
      expect(isWellFormedSecret(value, SECRET_KINDS.device)).toBe(false);
    },
  );
});
