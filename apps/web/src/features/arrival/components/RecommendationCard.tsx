import { Link } from 'react-router-dom';

import type { TutorMove } from '@aria/shared';

export function RecommendationCard(
  props: Readonly<{
    move: TutorMove | null;
    href: string | null;
  }>,
): React.JSX.Element | null {
  if (props.move?.kind !== 'RECOMMEND' || props.href === null) return null;
  return (
    <aside className="arrival-recommendation">
      <span>Aria suggests</span>
      <strong>{props.move.speech?.text}</strong>
      <p>{props.move.reason}</p>
      <Link to={props.href}>Try this class</Link>
    </aside>
  );
}
