import { usableVoices } from '../lib/voice'

interface VoicePickerProps {
  voices: SpeechSynthesisVoice[]
  /** Currently selected voice, already resolved by the parent. */
  value?: SpeechSynthesisVoice
  onChange: (uri: string) => void
}

/** Strips the platform's parenthetical noise so the list reads like names, not SKUs. */
function label(v: SpeechSynthesisVoice): string {
  const name = v.name.replace(/\s*\((Enhanced|Premium)\)\s*/i, ' ✨').trim()
  const region = v.lang?.toUpperCase().split('-')[1]
  const base = region && !name.includes(region) ? `${name} · ${region}` : name
  // Cloud voices go quiet when the service can't be reached, so say so up front.
  return v.localService ? base : `${base} (needs internet)`
}

/**
 * Lets a family pick the narration voice. Which voices exist varies enormously by
 * machine and browser, and "pleasant" is a matter of taste, so the choice is theirs —
 * the app only guarantees the joke voices never appear and the best one is preselected.
 *
 * This component deliberately never calls speechSynthesis itself. It used to speak a
 * preview here, which raced the lesson's own playback: both cancelled and re-queued the
 * one global speech engine within milliseconds of each other, and that rapid
 * cancel/speak churn is what left Aria silent after changing voice. The owning component
 * drives all speech instead.
 */
export default function VoicePicker({ voices, value, onChange }: VoicePickerProps) {
  const options = usableVoices(voices)
  if (options.length <= 1) return null

  return (
    <label className="voice-pick">
      <span className="voice-pick__label">🎤 Aria's voice</span>
      <select
        className="voice-pick__select"
        value={value?.voiceURI ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{label(v)}</option>)}
      </select>
    </label>
  )
}
