import { DoneCard } from '@/features/session/components/DoneCard';
import { InputSurface } from '@/features/session/components/InputSurface';
import { SessionControls } from '@/features/session/components/SessionControls';
import { TutorStatus } from '@/features/session/components/TutorStatus';
import type { TutorSession } from '@/features/session/hooks/useTutorSession';
import { MoveView } from '@/features/session/render/registry';

function CurrentMove(props: { session: TutorSession }): React.JSX.Element {
  const move = props.session.state.currentMove;
  if (move === null) return <p aria-live="polite">Take your time.</p>;
  return (
    <>
      <MoveView band={props.session.state.band} move={moveWithSupportingVisual(props.session)} />
      <InputSurface
        band={props.session.state.band}
        move={move}
        onAnswer={(value) => {
          void props.session.answer(move.id, value);
        }}
        onDrag={() => {
          void props.session.completeDrag(move.id);
        }}
        onSpeech={() => {
          void props.session.speak();
        }}
      />
    </>
  );
}

export function LayoutContent(props: { session: TutorSession }): React.JSX.Element {
  if (props.session.state.ended) return <DoneCard />;
  return (
    <div className="session-main">
      <TutorStatus status={props.session.state.status} />
      <section className="session-card">
        <CurrentMove session={props.session} />
      </section>
      <SessionControls
        band={props.session.state.band}
        paused={props.session.state.paused}
        onBackchannel={() => {
          void props.session.backchannel();
        }}
        onConfused={() => {
          void props.session.confused();
        }}
        onInterrupt={() => {
          void props.session.interrupt();
        }}
        onPause={() => {
          void props.session.pause();
        }}
        onQuestion={(text) => {
          void props.session.askQuestion(text);
        }}
        onResume={() => {
          void props.session.resume();
        }}
        showQuestion={props.session.state.band === 'early'}
      />
      <button
        className="session-action"
        onClick={() => {
          void props.session.leave();
        }}
        type="button"
      >
        End session
      </button>
    </div>
  );
}

function moveWithSupportingVisual(
  session: TutorSession,
): NonNullable<typeof session.state.currentMove> {
  const move = session.state.currentMove;
  if (move === null) throw new Error('A current move is required');
  if (move.display.some((content) => content.type === 'visual')) return move;
  if (move.kind !== 'ASK') return move;
  const supporting = session.state.moves.at(-2);
  if (supporting?.kind !== 'SHOW') return move;
  const visual = supporting.display.filter((content) => content.type === 'visual');
  if (visual.length === 0) return move;
  return { ...move, display: [...visual, ...move.display] };
}
