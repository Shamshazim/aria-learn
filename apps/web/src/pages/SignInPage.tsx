import { Navigate } from 'react-router-dom';

import { ParentSignInForm, useAuth } from '@/features/auth';
import '@/features/auth/styles/auth.css';

/**
 * Where a grown-up signs in (P2H-12).
 *
 * The device stays signed in as the parent afterwards — that is the shared-tablet reality this
 * ticket is built around — and the children of that account are what the picker then shows.
 */
export default function SignInPage(): React.JSX.Element {
  const { state, signInParent } = useAuth();
  if (state.parent !== null) return <Navigate replace to="/who" />;
  return (
    <main className="auth-page">
      <h1 className="auth-page__title">Aria Learn</h1>
      <p className="auth-page__lead">A grown-up signs in once on this device.</p>
      <ParentSignInForm
        busy={state.busy}
        problem={state.problem === null ? null : 'That did not work. Please try again.'}
        onSubmit={(email, password) => {
          void signInParent(email, password);
        }}
      />
    </main>
  );
}
