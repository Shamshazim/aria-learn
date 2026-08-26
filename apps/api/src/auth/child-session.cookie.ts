import type { CookieOptions, Request, Response } from 'express';

/**
 * The cookie a child session travels in (P2H-12).
 *
 * It is `httpOnly` because no script on the page has any reason to read it, `sameSite: lax`
 * so a cross-site form post cannot ride it, and `secure` everywhere but local development,
 * where there is no TLS to be secure over.
 *
 * It is also *signed*. The signature is not what makes the session valid — the row in
 * `child_session` is — but it lets a tampered or truncated cookie be thrown away before it
 * costs a query, which on a shared tablet full of half-deleted state is most of them.
 */
export const CHILD_SESSION_COOKIE = 'aria_child_session';

/** `<session id>.<secret>`: the id finds the row, the secret proves the holder. */
export function packCookie(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

export function unpackCookie(value: string): Readonly<{ id: string; secret: string }> | null {
  const separator = value.indexOf('.');
  if (separator <= 0 || separator === value.length - 1) return null;
  return { id: value.slice(0, separator), secret: value.slice(separator + 1) };
}

/**
 * The signed cookie this request carries, if it carries one that survived its signature.
 *
 * Read through `unknown`: `signedCookies` is typed as always present, and it is only present
 * because `app.ts` mounted the parser. A route reached some other way — a test building a bare
 * router — must get "no cookie" rather than a crash.
 */
export function readChildCookie(request: Request): string | null {
  const cookies: unknown = request.signedCookies;
  if (typeof cookies !== 'object' || cookies === null) return null;
  const value: unknown = Object.getOwnPropertyDescriptor(cookies, CHILD_SESSION_COOKIE)?.value;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function setChildCookie(
  response: Response,
  value: string,
  input: Readonly<{ expiresAt: Date; secure: boolean }>,
): void {
  response.cookie(CHILD_SESSION_COOKIE, value, options(input));
}

/**
 * Cleared with the attributes it was set with. A browser matches a deletion to a cookie by
 * name, path and domain, so a mismatch here would leave a dead cookie on the device.
 *
 * `signed` and `expires` are dropped: `clearCookie` supplies its own expiry in the past, and
 * signing the empty value it writes would produce a signature nobody will ever check.
 */
export function clearChildCookie(response: Response, secure: boolean): void {
  const { signed: _signed, expires: _expires, ...rest } = options({ expiresAt: EPOCH, secure });
  response.clearCookie(CHILD_SESSION_COOKIE, rest);
}

const EPOCH = new Date(0);

function options(input: Readonly<{ expiresAt: Date; secure: boolean }>): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: input.secure,
    signed: true,
    path: '/',
    expires: input.expiresAt,
  };
}
