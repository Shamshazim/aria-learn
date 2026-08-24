import { AskAriaPanel } from '@/features/session/components/AskAriaPanel';
import type { TutorSession } from '@/features/session/hooks/useTutorSession';
import { LayoutContent } from '@/features/session/layouts/LayoutContent';

export function SeniorLayout(props: { session: TutorSession }): React.JSX.Element {
  if (props.session.state.ended) {
    return (
      <div className="session-layout session-layout--complete">
        <LayoutContent session={props.session} />
      </div>
    );
  }
  return (
    <div className="session-layout session-layout--senior">
      <LayoutContent session={props.session} />
      <AskAriaPanel
        band="senior"
        onQuestion={(text) => {
          void props.session.askQuestion(text);
        }}
      />
    </div>
  );
}
