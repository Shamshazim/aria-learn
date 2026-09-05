import type { Band } from '@aria/shared';

import { SessionIcon } from '@/features/session/components/SessionIcon';

export function SessionControls(props: {
  band: Band;
  paused: boolean;
  /** A question is open, so the child may leave it: the answer is shown and a new one follows. */
  canSkip: boolean;
  onBackchannel: () => void;
  onConfused: () => void;
  onInterrupt: () => void;
  onPause: () => void;
  onQuestion: (text?: string) => void;
  onResume: () => void;
  onSkip: () => void;
  showQuestion: boolean;
}): React.JSX.Element {
  return (
    <div aria-label="Session controls" className="session-controls" role="group">
      {props.showQuestion || props.band !== 'early' ? (
        <QuestionControl band={props.band} onQuestion={props.onQuestion} />
      ) : null}
      <button onClick={props.onConfused} type="button">
        <SessionIcon name="confused" /> <span>I don&apos;t get it</span>
      </button>
      {props.canSkip ? (
        <button className="session-controls__skip" onClick={props.onSkip} type="button">
          <SessionIcon name="send" /> <span>Skip this one</span>
        </button>
      ) : null}
      <button onClick={props.onInterrupt} type="button">
        <SessionIcon name="hand" /> <span>Let me talk</span>
      </button>
      <button onClick={props.onBackchannel} type="button">
        <SessionIcon name="thumb" /> <span>I&apos;m with you</span>
      </button>
      {props.paused ? (
        <button onClick={props.onResume} type="button">
          <SessionIcon name="play" /> <span>Continue</span>
        </button>
      ) : (
        <button onClick={props.onPause} type="button">
          <SessionIcon name="pause" /> <span>Take a break</span>
        </button>
      )}
    </div>
  );
}

function QuestionControl(props: {
  band: Band;
  onQuestion: (text?: string) => void;
}): React.JSX.Element {
  if (props.band !== 'early') {
    return (
      <form
        className="session-question-control session-question-control--compact"
        onSubmit={(event) => {
          event.preventDefault();
          const question = new FormData(event.currentTarget).get('question');
          props.onQuestion(typeof question === 'string' ? question : '');
        }}
      >
        <input
          aria-label="Ask Aria on this screen"
          maxLength={2_000}
          name="question"
          placeholder="Ask Aria"
          required
        />
        <button type="submit">Ask</button>
      </form>
    );
  }
  return (
    <button
      className="session-question-control"
      onClick={() => {
        props.onQuestion();
      }}
      type="button"
    >
      <SessionIcon name="send" /> <span>Ask Aria</span>
    </button>
  );
}
