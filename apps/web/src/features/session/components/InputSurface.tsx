import { useState } from 'react';

import type { Band, TutorMove } from '@aria/shared';

export function InputSurface(props: {
  band: Band;
  move: TutorMove;
  onAnswer: (value: string) => void;
  onDrag: () => void;
  onSpeech: () => void;
}): React.JSX.Element | null {
  switch (props.move.expects) {
    case 'none':
      return null;
    case 'choice':
      return <Choices move={props.move} onAnswer={props.onAnswer} />;
    case 'number':
      return props.band === 'early' ? (
        <TapNumbers key={props.move.id} onAnswer={props.onAnswer} />
      ) : (
        <TextEntry inputMode="numeric" onAnswer={props.onAnswer} />
      );
    case 'text':
      return props.band === 'early' ? (
        <SpeakButton onSpeech={props.onSpeech} />
      ) : (
        <TextEntry inputMode="text" onAnswer={props.onAnswer} />
      );
    case 'speech':
      return <SpeakButton onSpeech={props.onSpeech} />;
    case 'drag':
      return (
        <button
          onClick={() => {
            props.onDrag();
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
  const [value, setValue] = useState('');
  return (
    <div className="tap-number-input">
      <output aria-live="polite">{value.length === 0 ? 'Choose a number' : value}</output>
      <div className="session-choices">
        {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '.', '/'].map((digit) => (
          <button
            key={digit}
            onClick={() => {
              setValue((current) => current + digit);
            }}
            type="button"
          >
            {digit}
          </button>
        ))}
        <button
          onClick={() => {
            setValue((current) => current.slice(0, -1));
          }}
          type="button"
        >
          Erase
        </button>
      </div>
      <button
        disabled={value.length === 0}
        onClick={() => {
          props.onAnswer(value);
        }}
        type="button"
      >
        Answer
      </button>
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

function SpeakButton(props: { onSpeech: () => void }): React.JSX.Element {
  return (
    <button
      className="speak-button"
      onClick={() => {
        props.onSpeech();
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
