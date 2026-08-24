import type { MockSessionView } from '@/features/session/hooks/useMockSession';
import { LayoutContent } from '@/features/session/layouts/LayoutContent';
import type { MockSession } from '@/features/session/model/mock-session';

export function SeniorLayout(props: {
  session: MockSession;
  view: MockSessionView;
}): React.JSX.Element {
  return (
    <div className="session-layout session-layout--senior">
      <LayoutContent {...props} allowWriting />
      <aside className="aria-thread">
        <h2>Conversation</h2>
        <p>Try a step, then explain what you notice.</p>
      </aside>
    </div>
  );
}
