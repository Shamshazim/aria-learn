import { useEffect, useState } from 'react'

/** Reads text aloud using the browser's built-in speech synthesis (offline, no backend). */
export default function ReadAloud({ text, label = 'Read to me' }: { text: string; label?: string }) {
  const [speaking, setSpeaking] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel() }, [supported])

  const toggle = () => {
    if (!supported) return
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.95
    u.pitch = 1.1
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(u)
  }

  if (!supported) return null
  return (
    <button className="read-btn" onClick={toggle} type="button">
      {speaking ? '⏹ Stop' : `🔊 ${label}`}
    </button>
  )
}
