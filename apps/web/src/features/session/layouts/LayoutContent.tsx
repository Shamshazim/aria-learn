import { ChoiceButtons } from '@/features/session/components/ChoiceButtons';
import { DoneCard } from '@/features/session/components/DoneCard';
import { Progress } from '@/features/session/components/Progress';
import type { MockSessionView } from '@/features/session/hooks/useMockSession';
import type { MockSession } from '@/features/session/model/mock-session';

export function LayoutContent(props: {
  session: MockSession;
  view: MockSessionView;
  allowWriting: boolean;
}): React.JSX.Element {
  if (props.view.complete) return <DoneCard />;
  const step = props.session.steps[props.view.stepIndex];
  if (step === undefined) return <DoneCard />;
  const correct = props.view.selected === step.answer;
  return (
    <div className="session-main">
      <section className="session-card">
        <p className="session-speech">{step.prompt}</p>
        <ChoiceButtons
          answer={step.answer}
          choices={step.choices}
          onChoose={props.view.choose}
          selected={props.view.selected}
        />
        {props.allowWriting ? (
          <textarea aria-label="Work pad" placeholder="Use this space to work it out." />
        ) : null}
        {props.view.hint === null ? null : <p className="session-hint">Hint: {props.view.hint}</p>}
        {correct ? <p className="session-verdict">That works. Nice thinking.</p> : null}
      </section>
      <Progress current={props.view.stepIndex} total={props.session.steps.length} />
      <button
        className="session-action"
        disabled={!correct}
        onClick={props.view.next}
        type="button"
      >
        Next
      </button>
    </div>
  );
}
