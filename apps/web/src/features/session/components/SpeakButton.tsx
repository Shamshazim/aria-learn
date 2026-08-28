import type { Band } from '@aria/shared';

import { VOICE_REASON_COPY } from '@/features/session/copy/voice.copy';
import type { VoiceAvailability } from '@/features/session/model/voice-availability';

/**
 * "Talk to Aria", and the reason when it cannot.
 *
 * The button used to do nothing at all when the room had not connected — a child pressing it
 * heard silence and concluded Aria was ignoring them. Now it is disabled with the reason
 * beside it, inside the card, where the child is already looking.
 */
export function SpeakButton(props: {
  band: Band;
  voice: VoiceAvailability;
  onSpeech: () => void;
}): React.JSX.Element {
  if (props.voice === 'ready') {
    return (
      <div className="speak-row">
        <TalkButton onSpeech={props.onSpeech} />
      </div>
    );
  }
  return (
    <div className="speak-row">
      <TalkButton disabled onSpeech={props.onSpeech} />
      <p className="speak-reason" id="speak-reason" role="status">
        {VOICE_REASON_COPY[props.voice][props.band]}
      </p>
    </div>
  );
}

function TalkButton(props: { disabled?: boolean; onSpeech: () => void }): React.JSX.Element {
  const disabled = props.disabled === true;
  return (
    <button
      aria-describedby={disabled ? 'speak-reason' : undefined}
      className="speak-button"
      disabled={disabled}
      onClick={() => {
        props.onSpeech();
      }}
      type="button"
    >
      <span aria-hidden="true">🎤</span> Talk to Aria
    </button>
  );
}
