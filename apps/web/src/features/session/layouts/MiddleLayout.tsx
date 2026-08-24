import { AriaOwl } from '@/features/session/components/AriaOwl';
import type { MockSessionView } from '@/features/session/hooks/useMockSession';
import { LayoutContent } from '@/features/session/layouts/LayoutContent';
import type { MockSession } from '@/features/session/model/mock-session';

export function MiddleLayout(props: {
  session: MockSession;
  view: MockSessionView;
}): React.JSX.Element {
  return (
    <div className="session-layout session-layout--middle">
      <LayoutContent {...props} allowWriting={false} />
      <aside className="aria-companion">
        <AriaOwl />
        <h2>Ask Aria</h2>
        <p>I can help you think it through.</p>
      </aside>
    </div>
  );
}
