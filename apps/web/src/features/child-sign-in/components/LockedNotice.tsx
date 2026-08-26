import { formatWait, useCountdown } from '../hooks/useCountdown';
import { avatarFace } from '../model/pictures';

import type { ChildProfile } from '../api/child-auth.api';

/**
 * What five wrong tries looks like.
 *
 * It names the wait and it does not blame the child: a locked profile is usually a child who
 * forgot, not an attacker, and the screen a real child sees far more often should read that
 * way. The only way out is time or a grown-up.
 */
export function LockedNotice(
  props: Readonly<{ profile: ChildProfile; seconds: number; onDone(): void }>,
): React.JSX.Element {
  const remaining = useCountdown(props.seconds, props.onDone);
  const face = avatarFace(props.profile.avatarKey);

  return (
    <section className="child-sign-in__step child-sign-in__step--locked">
      <p aria-hidden="true" className="child-sign-in__big-face">
        {face.emoji}
      </p>
      <h1 className="child-sign-in__title">Let&rsquo;s take a break.</h1>
      <p className="child-sign-in__hint">
        Aria will be ready again soon. Ask a grown-up if you forgot your pictures.
      </p>
      <p aria-live="polite" className="child-sign-in__countdown">
        <span className="visually-hidden">Time left: </span>
        {formatWait(remaining)}
      </p>
    </section>
  );
}
