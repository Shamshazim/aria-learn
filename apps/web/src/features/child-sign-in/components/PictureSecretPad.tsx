import { SECRET_PICTURE_LENGTH } from '@aria/shared';
import type { SecretPictureKey } from '@aria/shared';

import { SECRET_ORDER, avatarFace, secretFace } from '../model/pictures';

import { PictureTile } from './PictureTile';

import type { ChildProfile } from '../api/child-auth.api';

/**
 * Four pictures, in order.
 *
 * The taps show as filled dots rather than as the pictures themselves — a secret typed in
 * front of a sibling is not a secret. There is no submit button: the fourth tap sends it,
 * because a child who can work a submit button can also read.
 */
export function PictureSecretPad(
  props: Readonly<{
    profile: ChildProfile;
    taps: readonly SecretPictureKey[];
    retry: boolean;
    submitting: boolean;
    onTap(picture: SecretPictureKey): void;
    onUndo(): void;
    onBack(): void;
  }>,
): React.JSX.Element {
  const face = avatarFace(props.profile.avatarKey);
  return (
    <section className="child-sign-in__step">
      <h1 className="child-sign-in__title">
        <span aria-hidden="true">{face.emoji}</span> Hello, {props.profile.nickname}!
      </h1>
      <p className="child-sign-in__hint">Tap your four pictures.</p>

      <SecretProgress filled={props.taps.length} retry={props.retry} />

      {props.retry ? <p className="child-sign-in__retry">That was not it. Try again.</p> : null}

      <ul className="picture-grid picture-grid--secret">
        {SECRET_ORDER.map((key) => (
          <li key={key}>
            <PictureTile
              disabled={props.submitting || props.taps.length >= SECRET_PICTURE_LENGTH}
              face={secretFace(key)}
              onPress={() => {
                props.onTap(key);
              }}
            />
          </li>
        ))}
      </ul>

      <div className="child-sign-in__actions">
        <button
          className="child-sign-in__button"
          disabled={props.submitting || props.taps.length === 0}
          onClick={props.onUndo}
          type="button"
        >
          Undo
        </button>
        <button
          className="child-sign-in__button"
          disabled={props.submitting}
          onClick={props.onBack}
          type="button"
        >
          Not me
        </button>
      </div>
    </section>
  );
}

/**
 * Four dots, and the same thing said out loud.
 *
 * Dots rather than the pictures themselves: a secret shown back in front of a sibling is not
 * a secret any more.
 */
function SecretProgress(props: Readonly<{ filled: number; retry: boolean }>): React.JSX.Element {
  return (
    <p aria-live="polite" className="secret-progress">
      <span className="visually-hidden">
        {props.filled} of {SECRET_PICTURE_LENGTH} pictures tapped
        {props.retry ? '. That was not right. Try again.' : ''}
      </span>
      {Array.from({ length: SECRET_PICTURE_LENGTH }, (_, index) => (
        <span
          aria-hidden="true"
          className="secret-progress__dot"
          data-filled={index < props.filled ? 'yes' : undefined}
          key={index}
        />
      ))}
    </p>
  );
}
