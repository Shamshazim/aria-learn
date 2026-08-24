import type { TutorMove } from '@aria/shared';

import { MoveCard } from '@/features/session/render/renderers/shared/MoveCard';

export function EarlyMove(props: { move: TutorMove }): React.JSX.Element {
  return (
    <div className="band-move band-move--early">
      <span aria-hidden="true" className="band-move__marker">
        🦉
      </span>
      <MoveCard move={props.move} />
    </div>
  );
}
