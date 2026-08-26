import type { ApiClient, RequestOptions } from '@/api/client';

import type { CredentialStore } from '../model/credential-store';

/**
 * Attaches the child's session token to every request made through the wrapped client.
 *
 * A decorator rather than a parameter on each endpoint: the tutoring routes now authenticate
 * a child session (P0-28), and threading a header through every feature's api module would
 * mean each one could forget. This way the credential is a property of the client a page
 * holds, and a signed-out page simply holds one that sends no token.
 *
 * A caller's own `headers` win, so a request that carries a different credential — the device
 * secret on the sign-in screen — is not overwritten by this.
 */
const SESSION_HEADER = 'x-aria-child-session';

export function withChildSession(client: ApiClient, store: CredentialStore): ApiClient {
  function decorate(options: RequestOptions | undefined): RequestOptions | undefined {
    const token = store.sessionToken();
    if (token === null) return options;
    return { ...options, headers: { [SESSION_HEADER]: token, ...options?.headers } };
  }

  return {
    get: (path, schema, options) => client.get(path, schema, decorate(options)),
    post: (path, body, schema, options) => client.post(path, body, schema, decorate(options)),
    del: (path, schema, options) => client.del(path, schema, decorate(options)),
  };
}
