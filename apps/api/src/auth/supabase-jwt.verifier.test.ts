import { describe, expect, it } from 'vitest';

import { bearerToken } from './supabase-jwt.verifier';

/**
 * The signature check itself is `jose`'s, exercised end to end by the route tests through a
 * faked verifier port (CODE-STANDARDS §6: fake at the port, not with a network mock). What is
 * ours, and worth a table, is deciding whether a header carries a token at all.
 */
describe('reading the Authorization header', () => {
  it.each([
    ['Bearer abc.def.ghi', 'abc.def.ghi'],
    ['Bearer YQ==', 'YQ=='],
    [undefined, null],
    ['', null],
    ['bearer abc.def.ghi', null],
    ['Bearer', null],
    ['Bearer ', null],
    ['Bearer abc def', null],
    ['Basic abc', null],
    ['Bearer <script>', null],
  ])('%s', (header, expected) => {
    expect(bearerToken(header)).toBe(expected);
  });
});
