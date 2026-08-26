import type { PictureFace } from '../model/pictures';

/**
 * The one thing a child ever presses on this screen.
 *
 * It is a real `<button>` with a real text label, hidden visually but not from a screen
 * reader, so the tile is reachable by keyboard and by voice. The emoji is `aria-hidden`
 * because "grinning fox face" read aloud is not the name of anyone's picture.
 */
export function PictureTile(
  props: Readonly<{
    face: PictureFace;
    name?: string;
    size?: 'large' | 'medium';
    pressed?: boolean;
    disabled?: boolean;
    onPress(): void;
  }>,
): React.JSX.Element {
  const label = props.name ?? props.face.label;
  return (
    <button
      className={`picture-tile picture-tile--${props.size ?? 'medium'}`}
      data-pressed={props.pressed === true ? 'yes' : undefined}
      disabled={props.disabled === true}
      onClick={props.onPress}
      type="button"
    >
      <span aria-hidden="true" className="picture-tile__face">
        {props.face.emoji}
      </span>
      <span className="picture-tile__name">{label}</span>
    </button>
  );
}
