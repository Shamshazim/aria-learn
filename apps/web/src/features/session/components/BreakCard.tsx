import type { TutorMove } from '@aria/shared';

import { MoveCard } from '@/features/session/render/renderers/shared/MoveCard';

export function BreakCard(props: { move: TutorMove }): React.JSX.Element {
  return (
    <section aria-label="Session break" className="break-card">
      <MoveCard move={props.move} />
    </section>
  );
}
