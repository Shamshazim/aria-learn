import type { Band, TutorMove } from '@aria/shared';

export function InputSurface(props: {
  band: Band;
  move: TutorMove;
  onAnswer: (value: string) => void;
}): React.JSX.Element | null {
  switch (props.move.expects) {
    case 'none':
      return null;
    case 'choice':
      return <Choices move={props.move} onAnswer={props.onAnswer} />;
    case 'number':
      return props.band === 'early' ? (
        <TapNumbers onAnswer={props.onAnswer} />
      ) : (
        <TextEntry inputMode="numeric" onAnswer={props.onAnswer} />
      );
    case 'text':
      return props.band === 'early' ? (
        <SpeakButton onAnswer={props.onAnswer} />
      ) : (
        <TextEntry inputMode="text" onAnswer={props.onAnswer} />
      );
    case 'speech':
      return <SpeakButton onAnswer={props.onAnswer} />;
    case 'drag':
      return (
        <button
          onClick={() => {
            props.onAnswer('completed-drag');
          }}
        >
          Move the pieces
        </button>
      );
    default:
      return assertNever(props.move.expects);
  }
}

function Choices(props: { move: TutorMove; onAnswer: (value: string) => void }): React.JSX.Element {
  const options = props.move.display.flatMap((item) =>
    item.type === 'choices' ? item.options : [],
  );
  return (
    <div className="session-choices">
      {options.map((option) => (
        <button
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

function TapNumbers(props: { onAnswer: (value: string) => void }): React.JSX.Element {
  return (
    <div className="session-choices">
      {['6', '7', '8'].map((value) => (
        <button
          key={value}
          onClick={() => {
            props.onAnswer(value);
          }}
          type="button"
        >
          {value}
        </button>
      ))}
    </div>
  );
}

function TextEntry(props: {
  inputMode: 'numeric' | 'text';
  onAnswer: (value: string) => void;
}): React.JSX.Element {
  return (
    <form
      onSubmit={(event) => {
        submitText(event, props.onAnswer);
      }}
    >
      <input aria-label="Your answer" inputMode={props.inputMode} name="answer" required />
      <button type="submit">Answer</button>
    </form>
  );
}

function SpeakButton(props: { onAnswer: (value: string) => void }): React.JSX.Element {
  return (
    <button
      className="speak-button"
      onClick={() => {
        props.onAnswer('scripted speech');
      }}
      type="button"
    >
      <span aria-hidden="true">🎤</span> Talk to Aria
    </button>
  );
}

function submitText(
  event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>,
  onAnswer: (value: string) => void,
): void {
  event.preventDefault();
  const answer = new FormData(event.currentTarget).get('answer');
  onAnswer(typeof answer === 'string' ? answer : '');
}

function assertNever(value: never): never {
  throw new Error(`Unhandled input expectation: ${String(value)}`);
}
