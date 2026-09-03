import type { RealtimeVoice } from '@/features/voice/hooks/useRealtimeVoice';

export function VoiceControls(props: { voice: RealtimeVoice }): React.JSX.Element {
  const voice = props.voice;
  if (voice.status === 'needs-consent') {
    return (
      <aside className="voice-controls voice-controls--notice" role="status">
        A parent needs to turn on voice. You can keep learning with taps and text.
      </aside>
    );
  }
  if (voice.status === 'unavailable') {
    return (
      <aside className="voice-controls voice-controls--notice" role="status">
        Voice is taking a break. Taps and text still work.
      </aside>
    );
  }
  return (
    <aside aria-label="Voice controls" className="voice-controls">
      <button
        disabled={voice.status === 'connecting'}
        onClick={() => void voice.enable()}
        type="button"
      >
        {voice.status === 'ready' ? 'Turn on voice' : 'Sound check'}
      </button>
      <button
        disabled={voice.status !== 'listening' && voice.status !== 'muted'}
        onClick={() => void voice.mute()}
        type="button"
      >
        {voice.status === 'muted' ? 'Unmute' : 'Mute'}
      </button>
      <button className="voice-controls__stop" onClick={() => void voice.stopAria()} type="button">
        Stop Aria
      </button>
      <button onClick={voice.toggleCaptions} type="button">
        {voice.captions ? 'Hide captions' : 'Show captions'}
      </button>
      <label>
        Microphone
        <select
          onChange={(event) => void voice.chooseDevice(event.target.value)}
          value={voice.activeDeviceId}
        >
          <option value="">Default</option>
          {voice.devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || 'Microphone'}
            </option>
          ))}
        </select>
      </label>
      <meter aria-label="Microphone level" max={0.3} min={0} value={voice.microphoneLevel} />
      {voice.captions ? <VoiceCaptions voice={voice} /> : null}
    </aside>
  );
}

/** What Aria is saying, and — where she talks — what she heard the child say. */
function VoiceCaptions(props: { voice: RealtimeVoice }): React.JSX.Element | null {
  const { caption, heard, talks } = props.voice;
  if (caption.length === 0 && (!talks || heard.length === 0)) return null;
  return (
    <>
      {caption.length > 0 ? (
        <p aria-live="polite" className="voice-caption">
          <span className="voice-caption__who">Aria</span> {caption}
        </p>
      ) : null}
      {talks && heard.length > 0 ? (
        <p className="voice-caption voice-caption--heard">
          <span className="voice-caption__who">You</span> {heard}
        </p>
      ) : null}
    </>
  );
}
