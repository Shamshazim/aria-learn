import { useState } from 'react';

import { CHILD_PICTURES, PICTURE_SEQUENCE_LENGTH, type ChildPicture } from '@aria/shared';

import { CHILD_PICTURE_ART } from '@/features/auth/components/child-pictures.data';
import { ChildAvatar } from '@/features/auth/components/ChildAvatar';

/**
 * Tap three pictures, for the children who cannot read a PIN (P2H-12).
 *
 * The same six every time and in the same order, because a child who cannot read remembers
 * "the fox, then the star, then the whale" as a place on the screen as much as a name.
 */
export function PictureLogin({
  disabled = false,
  onSubmit,
}: Readonly<{
  disabled?: boolean;
  onSubmit(sequence: readonly ChildPicture[]): void;
}>): React.JSX.Element {
  const [taps, setTaps] = useState<readonly ChildPicture[]>([]);

  const tap = (picture: ChildPicture): void => {
    const next = [...taps, picture];
    setTaps(next.length >= PICTURE_SEQUENCE_LENGTH ? [] : next);
    if (next.length === PICTURE_SEQUENCE_LENGTH) onSubmit(next);
  };

  return (
    <div className="picture-login">
      <p aria-live="polite" className="picture-login__progress">
        {`${String(taps.length)} of ${String(PICTURE_SEQUENCE_LENGTH)} pictures tapped`}
      </p>
      <div className="picture-login__grid">
        {CHILD_PICTURES.map((picture) => (
          <button
            key={picture}
            aria-label={CHILD_PICTURE_ART[picture].label}
            className="picture-login__picture"
            disabled={disabled}
            type="button"
            onClick={() => {
              tap(picture);
            }}
          >
            <ChildAvatar picture={picture} size={64} />
          </button>
        ))}
      </div>
    </div>
  );
}
