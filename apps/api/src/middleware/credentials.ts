import type { Request } from 'express';

/**
 * Reading a credential off a request, in one place.
 *
 * Two transports, because P0-26 requires the same server contract to work in the web app and
 * in a possible desktop shell: a browser sends a `Secure; HttpOnly; SameSite` cookie, and a
 * shell holding the same grant in an OS credential store sends a header. Only the transport
 * differs, so only this file knows about it.
 *
 * Each credential has its own name and its own reader. An adult token and a child token can
 * never be presented in the same place, so neither can be mistaken for the other.
 */
export const CREDENTIAL_NAMES = {
  adult: { header: 'authorization', cookie: 'aria_adult' },
  childSession: { header: 'x-aria-child-session', cookie: 'aria_child' },
  device: { header: 'x-aria-device', cookie: 'aria_device' },
} as const;

export type CredentialName = keyof typeof CREDENTIAL_NAMES;

/** Bounded before anything parses it: a credential is short, and an unbounded one is an attack. */
const MAX_CREDENTIAL_LENGTH = 4096;

export function readCredential(request: Request, name: CredentialName): string | null {
  const source = CREDENTIAL_NAMES[name];
  const raw = name === 'adult' ? readBearer(request) : readHeader(request, source.header);
  const value = raw ?? readCookie(request, source.cookie);

  if (value === null || value.length === 0 || value.length > MAX_CREDENTIAL_LENGTH) return null;
  return value;
}

function readBearer(request: Request): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return null;

  const [scheme, token] = header.split(' ');
  // Case-insensitive because RFC 7235 says the scheme is, and a client that sends `bearer`
  // is not wrong — it is just not what a naive `startsWith('Bearer ')` expects.
  return scheme?.toLowerCase() === 'bearer' && token !== undefined ? token.trim() : null;
}

function readHeader(request: Request, header: string): string | null {
  const value = request.headers[header];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * One cookie, by name, without a parser dependency.
 *
 * Deliberately minimal: it splits on `;`, takes the first match, and decodes it. Anything
 * else a full cookie parser does — attributes, quoting, duplicate handling — is either the
 * server's business when *writing* cookies or an ambiguity we would rather reject than guess.
 */
function readCookie(request: Request, name: string): string | null {
  const header = request.headers.cookie;
  if (typeof header !== 'string') return null;

  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index <= 0) continue;
    if (pair.slice(0, index).trim() !== name) continue;

    const value = decodeURIComponent(pair.slice(index + 1).trim());
    return value.length > 0 ? value : null;
  }

  return null;
}
