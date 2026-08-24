import { DoneCard } from '@/features/session/components/DoneCard';
import { InputSurface } from '@/features/session/components/InputSurface';
import { SessionControls } from '@/features/session/components/SessionControls';
import { SessionProgress } from '@/features/session/components/SessionProgress';
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
  const progress = (
    <SessionProgress band={props.session.state.band} moves={props.session.state.moves} />
  );
  return (
    <div className="session-main">
      <TutorStatus status={props.session.state.status} />
      <section className="session-card">
        <CurrentMove session={props.session} />
        {props.session.state.band === 'senior' ? progress : null}
      </section>
      {props.session.state.band === 'senior' ? null : progress}
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
  const supporting = session.state.moves
    .slice(0, -1)
    .reverse()
    .find((candidate) => candidate.display.some((content) => content.type === 'visual'));
  if (supporting === undefined) return move;
  const visual = supporting.display.filter((content) => content.type === 'visual');
  return { ...move, display: [...visual, ...move.display] };
}
