import type { TutorMove } from '@aria/shared';

import { MoveCard } from '@/features/session/render/renderers/shared/MoveCard';

export function MiddleMove(props: { move: TutorMove }): React.JSX.Element {
  return (
    <div className="band-move band-move--middle">
      <span aria-hidden="true" className="band-move__marker">
        Aria's idea
      </span>
      <MoveCard move={props.move} />
    </div>
  );
}
