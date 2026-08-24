import { AskAriaPanel } from '@/features/session/components/AskAriaPanel';
import type { TutorSession } from '@/features/session/hooks/useTutorSession';
import { LayoutContent } from '@/features/session/layouts/LayoutContent';

export function MiddleLayout(props: { session: TutorSession }): React.JSX.Element {
  if (props.session.state.ended) {
    return (
      <div className="session-layout session-layout--complete">
        <LayoutContent session={props.session} />
      </div>
    );
  }
  return (
    <div className="session-layout session-layout--middle">
      <LayoutContent session={props.session} />
      <AskAriaPanel
        band="middle"
        onQuestion={props.session.askQuestion}
        reply={props.session.state.currentMove?.speech?.text ?? null}
      />
    </div>
  );
}
