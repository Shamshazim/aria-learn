import { useState } from 'react';

import type { AdultAuthProblem } from '../model/adult-auth.machine';

/**
 * The whole of the sign-in form: an address, and a button.
 *
 * No password, because there is no password — the identity provider owns the credential and
 * Aria never sees one (P0-26). The screen says the same thing whether or not the address has
 * an account, matching the endpoint, which always answers 202.
 */
export function MagicLinkForm(
  props: Readonly<{
    problem: AdultAuthProblem | null;
    sending: boolean;
    onSubmit(email: string): void;
  }>,
): React.JSX.Element {
  const [email, setEmail] = useState('');
  const ready = email.trim().length > 0 && !props.sending;

  return (
    <form
      className="adult-auth__form"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) props.onSubmit(email.trim());
      }}
    >
      <h1 className="adult-auth__title">Grown-ups</h1>
      <p className="adult-auth__hint">
        Enter your email and we&rsquo;ll send you a link to sign in. There is no password.
      </p>

      {props.problem === null ? null : (
        <p className="adult-auth__problem" role="alert">
          {problemText(props.problem)}
        </p>
      )}

      <label className="adult-auth__label" htmlFor="adult-email">
        Email
      </label>
      <input
        autoComplete="email"
        className="adult-auth__input"
        id="adult-email"
        onChange={(event) => {
          setEmail(event.target.value);
        }}
        required
        type="email"
        value={email}
      />
      <button className="adult-auth__button" disabled={!ready} type="submit">
        {props.sending ? 'Sending…' : 'Send me a link'}
      </button>
    </form>
  );
}

function problemText(problem: AdultAuthProblem): string {
  if (problem === 'link_expired') return 'That link has expired. Send yourself a new one.';
  if (problem === 'send_failed') return 'We could not send that email. Please try again.';
  if (problem === 'not_an_adult') return 'Aria accounts are for adults only.';
  return 'We could not sign you in. Please try again.';
}
