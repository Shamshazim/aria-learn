import type { TutorMove } from '@aria/shared';

import { DeliveryNotice } from '@/features/session/components/DeliveryNotice';
import { DoneCard } from '@/features/session/components/DoneCard';
import { InputSurface } from '@/features/session/components/InputSurface';
import { LiveSpeech } from '@/features/session/components/LiveSpeech';
import { SessionControls } from '@/features/session/components/SessionControls';
import { TutorStatus } from '@/features/session/components/TutorStatus';
import type { TutorSession } from '@/features/session/hooks/useTutorSession';
import { NO_LIVE_VOICE, type LiveVoice } from '@/features/session/model/live-voice';
import { composeScreen } from '@/features/session/model/screen-composition';
import type { SessionState } from '@/features/session/model/session-state';
import type { VoiceAvailability } from '@/features/session/model/voice-availability';
import { MoveView } from '@/features/session/render/registry';

type LayoutProps = Readonly<{
  session: TutorSession;
  voice: VoiceAvailability;
  /** What the voice is saying, where a realtime model is Aria's voice. */
  live?: LiveVoice | undefined;
}>;

function CurrentMove(props: LayoutProps): React.JSX.Element | null {
  const state = props.session.state;
  const live = props.live ?? NO_LIVE_VOICE;
  // P2H-07: the sentences Aria has already said. No input surface until the move arrives —
  // a half-written answer has nothing to answer yet.
  if (state.currentMove === null && state.streaming !== null) {
    return <p aria-live="polite">{state.streaming.text}</p>;
  }
  // P2H-11: nothing at all while there is no move. The status line above already says Aria is
  // listening; a filler sentence on top of it is the app talking to cover a silence, and the
  // silence ladder is what decides whether that silence needs anything said about it.
  const screen = composeScreen(state);
  const input = screen.input;
  if (input === null) return live.talks ? <LiveSpeech band={state.band} voice={live} /> : null;
  return (
    <>
      {live.talks ? <LiveSpeech band={state.band} voice={live} /> : null}
      {screen.cards
        .map((card) => asShown(state, card, live))
        .filter((card) => card.speech !== null || card.display.length > 0)
        .map((card) => (
          <MoveView band={state.band} key={card.id} move={card} />
        ))}
      <InputSurface
        band={state.band}
        move={input}
        voice={props.voice}
        onAnswer={(value) => {
          void props.session.answer(input.id, value);
        }}
        onDrag={() => {
          void props.session.completeDrag(input.id);
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
  const state = props.session.state;
  return (
    <div className="session-main">
      <TutorStatus status={state.status} />
      {retryFailed === null ? null : (
        <DeliveryNotice
          band={state.band}
          onRetry={() => {
            void retryFailed();
          }}
        />
      )}
      <section className="session-card">
        <CurrentMove {...props} />
      </section>
      <SessionControls
        band={state.band}
        canSkip={state.openQuestion !== null && !state.paused}
        paused={state.paused}
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
        onSkip={() => {
          void props.session.skip();
        }}
        showQuestion={state.band === 'early'}
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

/**
 * The card as the child should see it beside a talking voice: a question keeps its exact
 * words, because the voice is told to keep them exact too; anything else — a hint, praise, a
 * reveal — drops its stored line and the text that repeats it, because Aria is saying it in
 * her own words above. A picture or a passage stays: that is what the card is for.
 */
function asShown(state: SessionState, move: TutorMove, live: LiveVoice): TutorMove {
  const card = withSupportingVisual(state, move);
  if (!live.talks || card.kind === 'ASK' || card.speech === null) return card;
  const line = card.speech.text;
  return {
    ...card,
    speech: null,
    display: card.display.filter((item) => !(item.type === 'text' && item.body === line)),
  };
}

function withSupportingVisual(state: SessionState, move: TutorMove): TutorMove {
  if (move.display.some((content) => content.type === 'visual')) return move;
  if (move.kind !== 'ASK') return move;
  const supporting = state.moves.at(-2);
  if (supporting?.kind !== 'SHOW') return move;
  const visual = supporting.display.filter((content) => content.type === 'visual');
  if (visual.length === 0) return move;
  return { ...move, display: [...visual, ...move.display] };
}
