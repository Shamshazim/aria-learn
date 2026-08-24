import type { Band } from '@aria/shared';

export function SessionControls(props: {
  band: Band;
  paused: boolean;
  onBackchannel: () => void;
  onConfused: () => void;
  onInterrupt: () => void;
  onPause: () => void;
  onQuestion: (text?: string) => void;
  onResume: () => void;
}): React.JSX.Element {
  return (
    <div aria-label="Session controls" className="session-controls" role="group">
      <QuestionControl band={props.band} onQuestion={props.onQuestion} />
      <button onClick={props.onConfused} type="button">
        🧩 <span>I don't get it</span>
      </button>
      <button onClick={props.onInterrupt} type="button">
        ✋ <span>Let me talk</span>
      </button>
      <button onClick={props.onBackchannel} type="button">
        👍 <span>I'm with you</span>
      </button>
      {props.paused ? (
        <button onClick={props.onResume} type="button">
          ▶️ <span>Continue</span>
        </button>
      ) : (
        <button onClick={props.onPause} type="button">
          ⏸️ <span>Take a break</span>
        </button>
      )}
    </div>
  );
}

function QuestionControl(props: {
  band: Band;
  onQuestion: (text?: string) => void;
}): React.JSX.Element {
  if (props.band === 'early') {
    return (
      <button
        onClick={() => {
          props.onQuestion();
        }}
        type="button"
      >
        ❓ <span>Ask Aria</span>
      </button>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        submitQuestion(event, props.onQuestion);
      }}
    >
      <input aria-label="Question for Aria" name="question" required />
      <button type="submit">Ask Aria</button>
    </form>
  );
}

function submitQuestion(
  event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>,
  onQuestion: (text?: string) => void,
): void {
  event.preventDefault();
  const question = new FormData(event.currentTarget).get('question');
  onQuestion(typeof question === 'string' ? question : '');
}
