import { DeliveryNotice } from '@/features/session/components/DeliveryNotice';
import { DoneCard } from '@/features/session/components/DoneCard';
import { InputSurface } from '@/features/session/components/InputSurface';
import { SessionControls } from '@/features/session/components/SessionControls';
import { TutorStatus } from '@/features/session/components/TutorStatus';
import type { TutorSession } from '@/features/session/hooks/useTutorSession';
import type { VoiceAvailability } from '@/features/session/model/voice-availability';
import { MoveView } from '@/features/session/render/registry';

type LayoutProps = Readonly<{ session: TutorSession; voice: VoiceAvailability }>;

function CurrentMove(props: LayoutProps): React.JSX.Element | null {
  const move = props.session.state.currentMove;
  const streaming = props.session.state.streaming;
  // P2H-07: the sentences Aria has already said. No input surface until the move arrives —
  // a half-written answer has nothing to answer yet.
  if (move === null && streaming !== null) return <p aria-live="polite">{streaming.text}</p>;
  // P2H-11: nothing at all while there is no move. The status line above already says Aria is
  // listening; a filler sentence on top of it is the app talking to cover a silence, and the
  // silence ladder is what decides whether that silence needs anything said about it.
  if (move === null) return null;
  return (
    <>
      <MoveView band={props.session.state.band} move={moveWithSupportingVisual(props.session)} />
      <InputSurface
        band={props.session.state.band}
        move={move}
        voice={props.voice}
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

export function LayoutContent(props: LayoutProps): React.JSX.Element {
  if (props.session.state.ended) return <DoneCard />;
  const retryFailed = props.session.retryFailed;
  return (
    <div className="session-main">
      <TutorStatus status={props.session.state.status} />
      {retryFailed === null ? null : (
        <DeliveryNotice
          band={props.session.state.band}
          onRetry={() => {
            void retryFailed();
          }}
        />
      )}
      <section className="session-card">
        <CurrentMove session={props.session} voice={props.voice} />
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
