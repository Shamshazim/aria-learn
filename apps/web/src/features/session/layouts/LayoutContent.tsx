import { DoneCard } from '@/features/session/components/DoneCard';
import { InputSurface } from '@/features/session/components/InputSurface';
import { TutorStatus } from '@/features/session/components/TutorStatus';
import type { TutorSession } from '@/features/session/hooks/useTutorSession';
import { MoveView } from '@/features/session/render/registry';

export function LayoutContent(props: { session: TutorSession }): React.JSX.Element {
  const move = props.session.state.currentMove;
  if (props.session.state.ended) return <DoneCard />;
  return (
    <div className="session-main">
      <TutorStatus status={props.session.state.status} />
      <section className="session-card">
        {move === null ? (
          <p aria-live="polite">Take your time.</p>
        ) : (
          <>
            <MoveView band={props.session.state.band} move={move} />
            <InputSurface
              band={props.session.state.band}
              move={move}
              onAnswer={(value) => {
                void props.session.send({ kind: 'ANSWER', respondsTo: move.id, text: value });
              }}
            />
          </>
        )}
      </section>
      <button
        className="session-action"
        onClick={() => {
          void props.session.send({ kind: 'LEAVE', reason: 'done' });
        }}
        type="button"
      >
        End session
      </button>
    </div>
  );
}
