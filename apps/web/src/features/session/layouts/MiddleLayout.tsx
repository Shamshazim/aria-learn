import { AriaOwl } from '@/features/session/components/AriaOwl';
import type { TutorSession } from '@/features/session/hooks/useTutorSession';
import { LayoutContent } from '@/features/session/layouts/LayoutContent';

export function MiddleLayout(props: { session: TutorSession }): React.JSX.Element {
  return (
    <div className="session-layout session-layout--middle">
      <LayoutContent session={props.session} allowWriting={false} />
      <aside className="aria-companion">
        <AriaOwl />
        <h2>Ask Aria</h2>
        <p>I can help you think it through.</p>
      </aside>
    </div>
  );
}
