import { AriaOwl } from '@/features/session/components/AriaOwl';
import type { TutorSession } from '@/features/session/hooks/useTutorSession';
import { LayoutContent } from '@/features/session/layouts/LayoutContent';

export function EarlyLayout(props: { session: TutorSession }): React.JSX.Element {
  return (
    <div className="session-layout session-layout--early">
      <AriaOwl large />
      <LayoutContent session={props.session} />
      <div className="star-jar" aria-label="Three stars earned" role="img">
        ⭐ ⭐ ⭐
      </div>
    </div>
  );
}
