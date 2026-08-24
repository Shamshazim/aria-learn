export function ChoiceButtons(props: {
  choices: readonly string[];
  selected: string | null;
  answer: string;
  onChoose(value: string): void;
}): React.JSX.Element {
  return (
    <div className="session-choices" aria-label="Choose an answer" role="group">
      {props.choices.map((choice) => {
        const state =
          props.selected === null
            ? ''
            : choice === props.answer
              ? 'is-correct'
              : choice === props.selected
                ? 'is-wrong'
                : '';
        return (
          <button
            className={state}
            key={choice}
            onClick={() => { props.onChoose(choice); }}
            type="button"
          >
            {choice}
          </button>
        );
      })}
    </div>
  );
}
