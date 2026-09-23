import type { Band } from '@aria/shared';

import { AriaOwl } from '@/features/session/components/AriaOwl';
import type { LiveVoice } from '@/features/session/model/live-voice';

/**
 * Aria's own words, as she says them ("Aria talks").
 *
 * A move's stored line is what the curriculum would have said; the transcript is what Aria
 * actually said, sentence by sentence. This is the bubble the child reads while she talks,
 * and it keeps growing until her turn ends.
 */
export function LiveSpeech(props: { band: Band; voice: LiveVoice }): React.JSX.Element | null {
  const text = props.voice.transcript.trim();
  if (text === '') return null;
  const mood = props.voice.speaking ? 'think' : 'idle';
  return (
    <div
      className="session-speech-row session-speech-row--live"
      data-speaking={props.voice.speaking}
    >
      {props.band === 'middle' ? <AriaOwl mood={mood} size={78} /> : null}
      {props.band === 'senior' ? <AriaOwl avatar mood={mood} size={40} /> : null}
      <p aria-live="polite" className="session-speech session-speech--live">
        {text}
      </p>
    </div>
  );
}
