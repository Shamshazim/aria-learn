import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { createApiClient } from '@/api';
import { webConfig } from '@/app/config';
import {
  createChildAuthApi,
  credentialStore,
  useChildSignIn,
  type ChildSignInViewModel,
} from '@/features/child-sign-in';
import { DeviceSetup } from '@/features/child-sign-in/components/DeviceSetup';
import { LockedNotice } from '@/features/child-sign-in/components/LockedNotice';
import { PictureSecretPad } from '@/features/child-sign-in/components/PictureSecretPad';
import { ProfilePicker } from '@/features/child-sign-in/components/ProfilePicker';
import '@/features/child-sign-in/styles/child-sign-in.css';

/**
 * The first screen on a family tablet.
 *
 * It holds no state of its own: `useChildSignIn` owns the flow and this file only chooses
 * which of the five screens the current state means (§2, UI logic apart from business logic).
 */
const childAuthApi = createChildAuthApi(createApiClient({ baseUrl: webConfig.apiBaseUrl }));

export default function ChildSignInPage(): React.JSX.Element {
  const navigate = useNavigate();
  const onSignedIn = useCallback(() => {
    void navigate('/choose', { replace: true });
  }, [navigate]);

  const signIn = useChildSignIn({ api: childAuthApi, store: credentialStore, onSignedIn });

  return (
    <div className="child-sign-in session-app" data-band="early">
      <Step signIn={signIn} />
    </div>
  );
}

function Step({ signIn }: Readonly<{ signIn: ChildSignInViewModel }>): React.JSX.Element | null {
  const state = signIn.state;

  switch (state.status) {
    // 'ready' shares this screen: a session that has just opened is one navigation away, and
    // showing nothing beats showing the picker again for a frame.
    case 'loading':
    case 'ready':
      return <p className="child-sign-in__hint">One moment…</p>;

    case 'needs_device':
      return <DeviceSetup onLink={signIn.linkDevice} onRetry={signIn.retry} />;

    case 'choosing':
      return <ProfilePicker profiles={state.profiles} onChoose={signIn.choose} />;

    case 'secret':
      return (
        <PictureSecretPad
          onBack={signIn.back}
          onTap={signIn.tap}
          onUndo={signIn.undo}
          profile={state.profile}
          retry={state.retry}
          submitting={state.submitting}
          taps={state.taps}
        />
      );

    case 'locked':
      return <LockedNotice onDone={signIn.back} profile={state.profile} seconds={state.seconds} />;
  }
}
