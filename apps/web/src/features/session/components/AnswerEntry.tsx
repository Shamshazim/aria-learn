import { useState } from 'react';

const NUMBER_KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '.', '/'] as const;

/**
 * A typed answer. `large` is the early band's version: one big field, one big button, and the
 * keypad the question calls for — a six-year-old can type a 7 but not find it on a keyboard.
 */
export function TextEntry(props: {
  inputMode: 'numeric' | 'text';
  large?: boolean;
  onAnswer: (value: string) => void;
}): React.JSX.Element {
  return (
    <form
      className={props.large === true ? 'answer-form answer-form--large' : 'answer-form'}
      onSubmit={(event) => {
        submitText(event, props.onAnswer);
      }}
    >
      <input
        aria-label="Your answer"
        autoComplete="off"
        inputMode={props.inputMode}
        name="answer"
        required
      />
      <button type="submit">Answer</button>
    </form>
  );
}

export function TapNumbers(props: { onAnswer: (value: string) => void }): React.JSX.Element {
  const [value, setValue] = useState('');
  return (
    <div className="number-pad">
      <output aria-live="polite">{value.length === 0 ? 'Choose a number' : value}</output>
      <div className="number-pad__keys">
        {NUMBER_KEYS.map((digit) => (
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
          className="number-pad__erase"
          onClick={() => {
            setValue((current) => current.slice(0, -1));
          }}
          type="button"
        >
          Erase
        </button>
      </div>
      <button
        className="answer-submit"
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

function submitText(
  event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>,
  onAnswer: (value: string) => void,
): void {
  event.preventDefault();
  const answer = new FormData(event.currentTarget).get('answer');
  onAnswer(typeof answer === 'string' ? answer : '');
}
