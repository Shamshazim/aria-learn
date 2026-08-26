import { Link } from 'react-router-dom';

import { identityApi } from '@/app/services';
import { AddChildForm, ChildSettingsRow, useAuth, useParentChildren } from '@/features/auth';
import '@/features/auth/styles/auth.css';

/**
 * The grown-up's screen (P2H-12): the children on this account, and how each one signs in.
 *
 * Deliberately small. A parent dashboard is P6-01; this is the part without which a family
 * cannot use the product at all.
 */
export default function ParentPage(): React.JSX.Element {
  const { state } = useAuth();
  const children = useParentChildren(identityApi, state.parent?.accessToken ?? null);

  return (
    <main className="auth-page">
      <h1 className="auth-page__title">Grown-ups</h1>
      {children.failed ? (
        <p className="auth-page__problem" role="alert">
          That did not save. Please try again.
        </p>
      ) : null}
      <ul className="parent-children">
        {children.children.map((child) => (
          <ChildSettingsRow
            key={child.id}
            busy={children.busy}
            child={child}
            onChange={(input) => {
              void children.update(child.id, input);
            }}
            onConsent={() => {
              void children.allowVoice(child.id);
            }}
          />
        ))}
      </ul>
      <AddChildForm
        busy={children.busy}
        onSubmit={(input) => {
          void children.add(input);
        }}
      />
      <footer className="auth-page__footer">
        <Link to="/who">Back to the picker</Link>
      </footer>
    </main>
  );
}
