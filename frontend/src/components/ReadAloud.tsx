import { useEffect, useState } from 'react'
import { loadSavedVoiceURI, speakSafely, utter } from '../lib/voice'

/**
 * Reads text aloud using the browser's built-in speech synthesis (offline, no backend).
 *
 * Uses the same calm voice selection as Aria's walkthrough, including whichever voice
 * the family picked there, so the app never suddenly switches to a different speaker.
 */
export default function ReadAloud({ text, label = 'Read to me' }: { text: string; label?: string }) {
  const [speaking, setSpeaking] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel() }, [supported])

  const toggle = () => {
    if (!supported) return
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return }
    const u = utter(text, loadSavedVoiceURI())
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    setSpeaking(true)
    speakSafely(u)
  }

  if (!supported) return null
  return (
    <button className="read-btn" onClick={toggle} type="button">
      {speaking ? '⏹ Stop' : `🔊 ${label}`}
    </button>
  )
}
