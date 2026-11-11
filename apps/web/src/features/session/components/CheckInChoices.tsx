import type { Band, TutorMove } from '@aria/shared';

/**
 * Aria's check-in (P3-05): "an easy one, or stop for today?", answered with one of two big
 * buttons — big in every band, because a child being asked how they are should not have to
 * aim — or out loud, through the speak button beside them.
 *
 * The tap sends the option's id as the answer to the check-in, which the API reads as a reply
 * and never grades.
 */
export function CheckInChoices(
  props: Readonly<{ band: Band; move: TutorMove; onAnswer: (value: string) => void }>,
): React.JSX.Element {
  const options = props.move.display.flatMap((item) =>
    item.type === 'choices' ? item.options : [],
  );
  return (
    <div
      aria-label="Your answer"
      className={
        props.band === 'early' ? 'answer-tiles check-in-choices' : 'answer-choices check-in-choices'
      }
      role="group"
    >
      {options.slice(0, 2).map((option, index) => (
        <button
          className={`answer-tile answer-tile--${String(index)} check-in-choice`}
          key={option.id}
          onClick={() => {
            props.onAnswer(option.id);
          }}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
