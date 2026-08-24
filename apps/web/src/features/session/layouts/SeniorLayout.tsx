import type { TutorSession } from '@/features/session/hooks/useTutorSession';
import { LayoutContent } from '@/features/session/layouts/LayoutContent';

export function SeniorLayout(props: { session: TutorSession }): React.JSX.Element {
  return (
    <div className="session-layout session-layout--senior">
      <LayoutContent session={props.session} />
      <aside className="aria-thread">
        <h2>Conversation</h2>
        <p>Try a step, then explain what you notice.</p>
      </aside>
    </div>
  );
}
