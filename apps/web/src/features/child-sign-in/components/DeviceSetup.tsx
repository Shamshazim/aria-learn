import { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * The screen a tablet shows before a parent has authorised it.
 *
 * The code is entered by the adult, from the parent console, and it is the device grant
 * secret — so this field is `type="password"` and its value is handed straight to the
 * credential store, never held anywhere else.
 */
export function DeviceSetup(
  props: Readonly<{ onLink(secret: string): void; onRetry(): void }>,
): React.JSX.Element {
  const [code, setCode] = useState('');
  const ready = code.trim().length > 0;

  return (
    <section className="child-sign-in__step child-sign-in__step--setup">
      <p aria-hidden="true" className="child-sign-in__big-face">
        🔒
      </p>
      <h1 className="child-sign-in__title">Ask a grown-up.</h1>
      <p className="child-sign-in__hint">
        This tablet is not set up yet. A grown-up can add it from their Aria account.
      </p>

      <form
        className="device-setup__form"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) props.onLink(code);
        }}
      >
        <label className="device-setup__label" htmlFor="device-code">
          Setup code
        </label>
        <input
          autoComplete="off"
          className="device-setup__input"
          id="device-code"
          onChange={(event) => {
            setCode(event.target.value);
          }}
          type="password"
          value={code}
        />
        <button className="child-sign-in__button" disabled={!ready} type="submit">
          Set up this tablet
        </button>
      </form>

      <div className="child-sign-in__actions">
        <button className="child-sign-in__button" onClick={props.onRetry} type="button">
          Try again
        </button>
        <Link className="child-sign-in__button" to="/grown-ups">
          Grown-up sign-in
        </Link>
      </div>
    </section>
  );
}
