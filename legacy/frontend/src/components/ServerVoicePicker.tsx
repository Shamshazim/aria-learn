import { ServerVoice } from '../lib/serverSpeech'

interface ServerVoicePickerProps {
  voices: ServerVoice[]
  value: string
  onChange: (name: string) => void
  busy?: boolean
}

/** Where a voice is from, so "Daniel" and "Tessa" aren't just names to choose blindly. */
const REGIONS: Record<string, string> = {
  en_US: 'American', en_GB: 'British', en_AU: 'Australian',
  en_IE: 'Irish', en_ZA: 'South African', en_IN: 'Indian',
}

function label(v: ServerVoice): string {
  const region = REGIONS[v.locale]
  return region ? `${v.name} · ${region}` : v.name
}

/**
 * Picks which macOS voice narrates the lesson.
 *
 * Unlike the browser picker this replaced, every option here is known to work: the
 * backend enumerates what is actually installed, so nothing on this list can turn out
 * to be silent.
 */
export default function ServerVoicePicker({ voices, value, onChange, busy }: ServerVoicePickerProps) {
  if (voices.length <= 1) return null

  return (
    <label className="voice-pick">
      <span className="voice-pick__label">🎤 Aria's voice</span>
      <select
        className="voice-pick__select"
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
      >
        {voices.map((v) => <option key={v.name} value={v.name}>{label(v)}</option>)}
      </select>
    </label>
  )
}
