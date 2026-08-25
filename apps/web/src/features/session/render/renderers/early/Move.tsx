import type { TutorMove } from '@aria/shared';

import { MoveCard } from '@/features/session/render/renderers/shared/MoveCard';

export function EarlyMove(props: { move: TutorMove }): React.JSX.Element {
  return (
    <div className="band-move band-move--early">
      <MoveCard band="early" move={props.move} />
    </div>
  );
}
