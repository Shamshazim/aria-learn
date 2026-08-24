import type { TutorMove } from '@aria/shared';

import { MoveCard } from '@/features/session/render/renderers/shared/MoveCard';

export function SeniorMove(props: { move: TutorMove }): React.JSX.Element {
  return (
    <div className="band-move band-move--senior">
      <MoveCard move={props.move} />
    </div>
  );
}
