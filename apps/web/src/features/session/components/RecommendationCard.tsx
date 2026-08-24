import type { TutorMove } from '@aria/shared';

import { MoveCard } from '@/features/session/render/renderers/shared/MoveCard';

export function RecommendationCard(props: { move: TutorMove }): React.JSX.Element {
  return (
    <section aria-label="Aria's recommendation" className="recommendation-card">
      <MoveCard move={props.move} />
    </section>
  );
}
