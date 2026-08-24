import { AriaOwl } from '@/features/session/components/AriaOwl';
import type { MockSessionView } from '@/features/session/hooks/useMockSession';
import { LayoutContent } from '@/features/session/layouts/LayoutContent';
import type { MockSession } from '@/features/session/model/mock-session';

export function EarlyLayout(props: {
  session: MockSession;
  view: MockSessionView;
}): React.JSX.Element {
  return (
    <div className="session-layout session-layout--early">
      <AriaOwl large />
      <LayoutContent {...props} allowWriting={false} />
      <div className="star-jar" aria-label="Three stars earned" role="img">
        ⭐ ⭐ ⭐
      </div>
    </div>
  );
}
