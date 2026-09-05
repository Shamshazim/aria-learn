import { AskAriaPanel } from '@/features/session/components/AskAriaPanel';
import type { TutorSession } from '@/features/session/hooks/useTutorSession';
import { LayoutContent } from '@/features/session/layouts/LayoutContent';
import type { LiveVoice } from '@/features/session/model/live-voice';
import type { VoiceAvailability } from '@/features/session/model/voice-availability';

export function SeniorLayout(props: {
  session: TutorSession;
  voice: VoiceAvailability;
  live?: LiveVoice;
}): React.JSX.Element {
  if (props.session.state.ended) {
    return (
      <div className="session-layout session-layout--complete">
        <LayoutContent live={props.live} session={props.session} voice={props.voice} />
      </div>
    );
  }
  return (
    <div className="session-layout session-layout--senior">
      <LayoutContent live={props.live} session={props.session} voice={props.voice} />
      <AskAriaPanel
        band="senior"
        onQuestion={props.session.askQuestion}
        reply={props.session.state.currentMove?.speech?.text ?? null}
      />
    </div>
  );
}
