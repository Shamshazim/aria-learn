import { createApiClient } from '@/api';
import { webConfig } from '@/app/config';
import { adultTokenStore, createAdultAuthApi, useAdultSignIn } from '@/features/adult-auth';
import type { AdultSignInViewModel } from '@/features/adult-auth';
import { AgeGate } from '@/features/adult-auth/components/AgeGate';
import { MagicLinkForm } from '@/features/adult-auth/components/MagicLinkForm';
import { SignedInPanel } from '@/features/adult-auth/components/SignedInPanel';
import '@/features/adult-auth/styles/adult-auth.css';

/**
 * The grown-up entrance. Four screens, chosen by state and nothing else (§2).
 */
const adultAuthApi = createAdultAuthApi(createApiClient({ baseUrl: webConfig.apiBaseUrl }));

export default function AdultSignInPage(): React.JSX.Element {
  const signIn = useAdultSignIn({ api: adultAuthApi, store: adultTokenStore });

  return (
    <div className="adult-auth">
      <Step signIn={signIn} />
    </div>
  );
}

function Step({ signIn }: Readonly<{ signIn: AdultSignInViewModel }>): React.JSX.Element {
  const state = signIn.state;

  switch (state.status) {
    case 'checking':
      return <p className="adult-auth__hint">One moment…</p>;

    case 'signed_out':
    case 'sending':
      return (
        <MagicLinkForm
          onSubmit={signIn.requestLink}
          problem={state.status === 'signed_out' ? state.problem : null}
          sending={state.status === 'sending'}
        />
      );

    case 'link_sent':
      return (
        <section className="adult-auth__panel">
          <h1 className="adult-auth__title">Check your email</h1>
          <p className="adult-auth__hint">
            If {state.email} has an Aria account, a sign-in link is on its way. The link works once
            and expires.
          </p>
        </section>
      );

    case 'attesting':
      return <AgeGate onSubmit={signIn.attest} submitting={state.submitting} />;

    case 'signed_in':
      return <SignedInPanel adult={state.adult} onSignOut={signIn.signOut} />;
  }
}
