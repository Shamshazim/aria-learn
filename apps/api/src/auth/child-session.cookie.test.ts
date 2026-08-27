import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import {
  CHILD_SESSION_COOKIE,
  clearChildCookie,
  packCookie,
  readChildCookie,
  setChildCookie,
  unpackCookie,
} from './child-session.cookie';

import type { Express } from 'express';

const SECRET = 'c'.repeat(32);
const EXPIRES = new Date('2026-08-25T22:00:00.000Z');

/**
 * A real Express app rather than a hand-built `Request`.
 *
 * Signing, parsing and clearing a cookie are the framework's, and a fake response object would
 * only prove that our options object has the keys we wrote in it. This proves the header a
 * browser actually receives, and that our own reader can read it back.
 */
function app(options: Readonly<{ withParser: boolean }>): Express {
  const server = express();
  if (options.withParser) server.use(cookieParser(SECRET));
  server.get('/set', (_request, response) => {
    setChildCookie(response, packCookie('session-1', 'the-secret'), {
      expiresAt: EXPIRES,
      secure: true,
    });
    response.status(200).end();
  });
  server.get('/read', (req, response) => {
    response.status(200).json({ cookie: readChildCookie(req) });
  });
  server.get('/clear', (_request, response) => {
    clearChildCookie(response, false);
    response.status(200).end();
  });
  return server;
}

describe('packing', () => {
  it('packs an id and a secret and gets both back', () => {
    expect(unpackCookie(packCookie('session-1', 'abc.def'))).toEqual({
      id: 'session-1',
      secret: 'abc.def',
    });
  });

  it('refuses a value that is not a pair', () => {
    expect(unpackCookie('no-separator')).toBeNull();
    expect(unpackCookie('.leading')).toBeNull();
    expect(unpackCookie('trailing.')).toBeNull();
  });
});

describe('the cookie on the wire', () => {
  it('is http-only, signed, same-site and secure', async () => {
    const response = await request(app({ withParser: true })).get('/set');
    const header = response.headers['set-cookie']?.[0] ?? '';

    expect(header).toContain(`${CHILD_SESSION_COOKIE}=s%3A`);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Secure');
    expect(header).toContain('Expires=Tue, 25 Aug 2026 22:00:00 GMT');
  });

  it('comes back through our own reader', async () => {
    const server = app({ withParser: true });
    const set = await request(server).get('/set');
    const cookie = set.headers['set-cookie']?.[0]?.split(';')[0] ?? '';

    const read = await request(server).get('/read').set('Cookie', cookie);

    expect(read.body).toEqual({ cookie: 'session-1.the-secret' });
  });

  it('reads nothing when the signature does not check out', async () => {
    const server = app({ withParser: true });

    const read = await request(server)
      .get('/read')
      .set('Cookie', `${CHILD_SESSION_COOKIE}=s%3Asession-1.the-secret.not-a-signature`);

    expect(read.body).toEqual({ cookie: null });
  });

  /** A router assembled without the parser must read "no cookie", not throw. */
  it('reads nothing at all when no parser was mounted', async () => {
    const read = await request(app({ withParser: false })).get('/read');

    expect(read.body).toEqual({ cookie: null });
  });

  it('is cleared with an expiry in the past and the attributes it was set with', async () => {
    const response = await request(app({ withParser: true })).get('/clear');
    const header = response.headers['set-cookie']?.[0] ?? '';

    expect(header).toContain('Expires=Thu, 01 Jan 1970');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Path=/');
  });
});
