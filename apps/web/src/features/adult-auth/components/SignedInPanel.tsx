import { Link } from 'react-router-dom';

import type { AdultAuthResponse } from '../api/adult-auth.api';

/**
 * Where a signed-in adult lands.
 *
 * The console that manages children, devices and consent is a later ticket; P0-28 built and
 * tested the endpoints behind it. This panel is honest about that rather than linking to
 * screens that do not exist yet.
 */
export function SignedInPanel(
  props: Readonly<{ adult: AdultAuthResponse; onSignOut(): void }>,
): React.JSX.Element {
  return (
    <section className="adult-auth__panel">
      <h1 className="adult-auth__title">You&rsquo;re signed in</h1>
      <p className="adult-auth__hint">
        Signed in as a {props.adult.role === 'parent' ? 'parent or guardian' : 'teacher'}. The place
        to add children, set their pictures and manage tablets is on its way.
      </p>
      <div className="adult-auth__actions">
        <Link className="adult-auth__button" to="/hello">
          Hand the tablet over
        </Link>
        <button className="adult-auth__button" onClick={props.onSignOut} type="button">
          Sign out
        </button>
      </div>
    </section>
  );
}
