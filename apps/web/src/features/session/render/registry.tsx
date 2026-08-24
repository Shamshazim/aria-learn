import type { Band, MoveKind, TutorMove } from '@aria/shared';

import { EarlyListen } from '@/features/session/render/renderers/early/Listen';
import { EarlyMove } from '@/features/session/render/renderers/early/Move';
import { MiddleMove } from '@/features/session/render/renderers/middle/Move';
import { SeniorMove } from '@/features/session/render/renderers/senior/Move';

export type MoveRenderer = (props: { move: TutorMove }) => React.JSX.Element;
type BandRegistry = Readonly<Record<MoveKind, MoveRenderer>>;

const early: BandRegistry = {
  WELCOME: EarlyMove,
  CHECK_IN: EarlyMove,
  RECOMMEND: EarlyMove,
  SAY: EarlyMove,
  SHOW: EarlyMove,
  ASK: EarlyMove,
  LISTEN: EarlyListen,
  HINT: EarlyMove,
  RETEACH: EarlyMove,
  REVEAL: EarlyMove,
  PRAISE: EarlyMove,
  SWITCH: EarlyMove,
  BREAK: EarlyMove,
  END: EarlyMove,
};

export const MOVE_RENDERERS: Readonly<Record<Band, BandRegistry>> = {
  early,
  middle: bandRenderers(MiddleMove),
  senior: bandRenderers(SeniorMove),
};

function bandRenderers(renderer: MoveRenderer): BandRegistry {
  return {
    WELCOME: renderer,
    CHECK_IN: renderer,
    RECOMMEND: renderer,
    SAY: renderer,
    SHOW: renderer,
    ASK: renderer,
    LISTEN: renderer,
    HINT: renderer,
    RETEACH: renderer,
    REVEAL: renderer,
    PRAISE: renderer,
    SWITCH: renderer,
    BREAK: renderer,
    END: renderer,
  };
}

export function MoveView(props: { band: Band; move: TutorMove }): React.JSX.Element {
  const Renderer = MOVE_RENDERERS[props.band][props.move.kind];
  return (
    <div aria-live="polite" aria-atomic="true" className="move-region">
      <Renderer move={props.move} />
    </div>
  );
}
