import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ChildAuthApi } from '../api/child-auth.api';
import type { CredentialStore } from '../model/credential-store';

/**
 * "I'm done" — the other half of switching profiles on a shared tablet.
 *
 * The token is forgotten locally before the request goes out, and the child leaves the screen
 * whether or not the request succeeds: a network failure must not be able to keep one child
 * signed in on the family tablet. The server-side revoke is what makes the token dead
 * everywhere, and it is retried by nothing — the session's idle window closes it anyway.
 */
export function SignOutButton(
  props: Readonly<{ api: ChildAuthApi; store: CredentialStore; label?: string }>,
): React.JSX.Element {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  const signOut = (): void => {
    const token = props.store.sessionToken();
    props.store.forgetSession();
    setLeaving(true);
    const revoked = token === null ? Promise.resolve(null) : props.api.end(token);
    void revoked.catch(() => null).then(() => navigate('/hello', { replace: true }));
  };

  return (
    <button className="child-sign-in__button" disabled={leaving} onClick={signOut} type="button">
      {props.label ?? "I'm done"}
    </button>
  );
}
