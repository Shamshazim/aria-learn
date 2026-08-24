import type { Band, MoveKind, TutorMove } from '@aria/shared';

import { BreakCard } from '@/features/session/components/BreakCard';
import { RecommendationCard } from '@/features/session/components/RecommendationCard';
import { EarlyListen } from '@/features/session/render/renderers/early/Listen';
import { MoveCard } from '@/features/session/render/renderers/shared/MoveCard';

export type MoveRenderer = (props: { move: TutorMove }) => React.JSX.Element;
type BandRegistry = Readonly<Record<MoveKind, MoveRenderer>>;

const shared: BandRegistry = {
  WELCOME: MoveCard,
  CHECK_IN: MoveCard,
  RECOMMEND: RecommendationCard,
  SAY: MoveCard,
  SHOW: MoveCard,
  ASK: MoveCard,
  LISTEN: MoveCard,
  HINT: MoveCard,
  RETEACH: MoveCard,
  REVEAL: MoveCard,
  PRAISE: MoveCard,
  SWITCH: MoveCard,
  BREAK: BreakCard,
  END: MoveCard,
};

export const MOVE_RENDERERS: Readonly<Record<Band, BandRegistry>> = {
  early: { ...shared, LISTEN: EarlyListen },
  middle: { ...shared },
  senior: { ...shared },
};

export function MoveView(props: { band: Band; move: TutorMove }): React.JSX.Element {
  const Renderer = MOVE_RENDERERS[props.band][props.move.kind];
  return (
    <div aria-live="polite" aria-atomic="true" className="move-region">
      <Renderer move={props.move} />
    </div>
  );
}
