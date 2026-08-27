import { useState } from 'react';

/**
 * The grown-up's sign-in (P2H-12).
 *
 * It is on a screen a child may be watching, so it says as little as possible: no account
 * hints, no "no such email", and one message for every way it can fail.
 */
export function ParentSignInForm({
  busy = false,
  problem = null,
  onSubmit,
}: Readonly<{
  busy?: boolean;
  problem?: string | null;
  onSubmit(email: string, password: string): void;
}>): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form
      className="parent-sign-in"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(email, password);
      }}
    >
      <label className="parent-sign-in__field" htmlFor="parent-email">
        Email
        <input
          autoComplete="email"
          id="parent-email"
          name="email"
          required
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
      </label>
      <label className="parent-sign-in__field" htmlFor="parent-password">
        Password
        <input
          autoComplete="current-password"
          id="parent-password"
          name="password"
          required
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
      </label>
      {problem === null ? null : (
        <p className="parent-sign-in__problem" role="alert">
          {problem}
        </p>
      )}
      <button className="parent-sign-in__submit" disabled={busy} type="submit">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
