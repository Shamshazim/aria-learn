import { Navigate } from 'react-router-dom';

import type { CredentialStore } from '../model/credential-store';

/**
 * A route that a signed-out tablet cannot reach.
 *
 * The check is only "is there a token here" — the server is the one that decides whether it is
 * still good, and it refuses expired and revoked tokens on every request. This exists so a
 * child whose session ended lands on the picture picker instead of on a class list that
 * quietly fails to load.
 */
export function RequireChildSession(
  props: Readonly<{ store: CredentialStore; required: boolean; children: React.ReactNode }>,
): React.JSX.Element {
  if (props.required && props.store.sessionToken() === null)
    return <Navigate replace to="/hello" />;
  return <>{props.children}</>;
}
