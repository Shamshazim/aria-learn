import type { MoveKind } from '@aria/shared';

import { DoneCard } from '@/features/session/components/DoneCard';
import type { TutorSession } from '@/features/session/hooks/useTutorSession';

export function LayoutContent(props: {
  session: TutorSession;
  allowWriting: boolean;
}): React.JSX.Element {
  const move = props.session.state.currentMove;
  if (props.session.state.ended) return <DoneCard />;
  if (move === null) return <p role="status">Aria is listening.</p>;
  const choices = move.display.flatMap((item) => (item.type === 'choices' ? item.options : []));
  const answer = (value: string): void => {
    void props.session.send({
      kind: 'ANSWER',
      respondsTo: move.id,
      text: value,
    });
  };
  return (
    <div className="session-main">
      <section className="session-card">
        <p className="session-speech">{move.speech?.text ?? describeSilentMove(move.kind)}</p>
        {choices.length === 0 ? null : (
          <div className="session-choices">
            {choices.map((choice) => (
              <button
                key={choice.id}
                onClick={() => {
                  answer(choice.id);
                }}
                type="button"
              >
                {choice.label}
              </button>
            ))}
          </div>
        )}
        {move.expects === 'number' && choices.length === 0 ? (
          <NumberInput early={!props.allowWriting} onAnswer={answer} />
        ) : null}
        {props.allowWriting && move.expects === 'text' ? (
          <textarea
            aria-label="Your answer"
            onBlur={(event) => {
              void props.session.send({
                kind: 'ANSWER',
                respondsTo: move.id,
                text: event.currentTarget.value,
              });
            }}
          />
        ) : null}
      </section>
      <EndSessionButton session={props.session} />
    </div>
  );
}

function EndSessionButton(props: { session: TutorSession }): React.JSX.Element {
  return (
    <button
      className="session-action"
      onClick={() => {
        void props.session.send({ kind: 'LEAVE', reason: 'done' });
      }}
      type="button"
    >
      End session
    </button>
  );
}

function NumberInput(props: { early: boolean; onAnswer(value: string): void }): React.JSX.Element {
  if (props.early) {
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
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const answer = data.get('answer');
        props.onAnswer(typeof answer === 'string' ? answer : '');
      }}
    >
      <input aria-label="Your answer" inputMode="numeric" name="answer" required />
      <button type="submit">Answer</button>
    </form>
  );
}

const SILENT_MOVE_LABELS: Readonly<Record<MoveKind, string>> = {
  WELCOME: 'welcome',
  CHECK_IN: 'check in',
  RECOMMEND: 'recommend',
  SAY: 'say',
  SHOW: 'show',
  ASK: 'ask',
  LISTEN: 'listen',
  HINT: 'hint',
  RETEACH: 'reteach',
  REVEAL: 'reveal',
  PRAISE: 'praise',
  SWITCH: 'switch',
  BREAK: 'break',
  END: 'end',
};

function describeSilentMove(kind: MoveKind): string {
  return SILENT_MOVE_LABELS[kind];
}
