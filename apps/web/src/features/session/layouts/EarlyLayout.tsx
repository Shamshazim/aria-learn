import { AriaOwl } from '@/features/session/components/AriaOwl';
import { StarJar } from '@/features/session/components/StarJar';
import type { TutorSession } from '@/features/session/hooks/useTutorSession';
import { LayoutContent } from '@/features/session/layouts/LayoutContent';
import type { VoiceAvailability } from '@/features/session/model/voice-availability';

export function EarlyLayout(props: {
  session: TutorSession;
  voice: VoiceAvailability;
}): React.JSX.Element {
  if (props.session.state.ended) {
    return (
      <div className="session-layout session-layout--complete">
        <LayoutContent session={props.session} voice={props.voice} />
      </div>
    );
  }
  const stars = props.session.state.moves.filter((move) => move.kind === 'PRAISE').length;
  return (
    <div className="session-layout session-layout--early">
      <div className="session-owl-column">
        <AriaOwl size={300} />
      </div>
      <LayoutContent session={props.session} voice={props.voice} />
      <div className="session-jar-column">
        <StarJar count={stars} />
      </div>
    </div>
  );
}
