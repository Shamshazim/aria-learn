import type { TutorMove } from '@aria/shared';

export function CheckInPrompt(
  props: Readonly<{
    move: TutorMove | null;
    selected: string | null;
    onSelect(value: string): void;
  }>,
): React.JSX.Element | null {
  if (props.move === null) return null;
  return (
    <fieldset className="arrival-check-in">
      <legend>{props.move.speech?.text}</legend>
      <button
        aria-pressed={props.selected === 'easy'}
        onClick={() => {
          props.onSelect('easy');
        }}
        type="button"
      >
        Easy start
      </button>
      <button
        aria-pressed={props.selected === 'challenge'}
        onClick={() => {
          props.onSelect('challenge');
        }}
        type="button"
      >
        Challenge me
      </button>
    </fieldset>
  );
}
