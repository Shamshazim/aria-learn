import { usableVoices, utter } from '../lib/voice'

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
  return region && !name.includes(region) ? `${name} · ${region}` : name
}

/**
 * Lets a family pick the narration voice. Which voices exist varies enormously by
 * machine and browser, and "pleasant" is a matter of taste, so the choice is theirs —
 * the app only guarantees the joke voices never appear and the best one is preselected.
 */
export default function VoicePicker({ voices, value, onChange }: VoicePickerProps) {
  const options = usableVoices(voices)
  if (options.length <= 1) return null

  const preview = (v: SpeechSynthesisVoice) => {
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter("Hi! I'm Aria. Let's learn something together.", v))
  }

  return (
    <label className="voice-pick">
      <span className="voice-pick__label">🎤 Aria's voice</span>
      <select
        className="voice-pick__select"
        value={value?.voiceURI ?? ''}
        onChange={(e) => {
          onChange(e.target.value)
          const v = options.find((o) => o.voiceURI === e.target.value)
          if (v) preview(v)
        }}
      >
        {options.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{label(v)}</option>)}
      </select>
    </label>
  )
}
