/**
 * Reading the access token the identity provider hands back in the redirect.
 *
 * Supabase's magic link returns the token in the URL *fragment*, which is the part a browser
 * never sends to a server — that is the point of it, and it is why this is read in the client
 * rather than on a callback route. It is taken once and then erased from the address bar, so
 * the credential does not sit in history or in a shared screen.
 */
export type MagicLinkReturn =
  | Readonly<{ kind: 'token'; accessToken: string }>
  /** The provider said no — an expired link, usually. */
  | Readonly<{ kind: 'error'; code: string }>
  | Readonly<{ kind: 'none' }>;

export function readMagicLinkReturn(hash: string): MagicLinkReturn {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

  const token = params.get('access_token');
  if (token !== null && token !== '') return { kind: 'token', accessToken: token };

  const error = params.get('error_code') ?? params.get('error');
  if (error !== null && error !== '') return { kind: 'error', code: error };

  return { kind: 'none' };
}

/** Drops the fragment without adding a history entry. */
export function clearMagicLinkReturn(window: Window): void {
  const { pathname, search } = window.location;
  window.history.replaceState(null, '', `${pathname}${search}`);
}
