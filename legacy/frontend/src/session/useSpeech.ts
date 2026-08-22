import { useCallback, useEffect, useRef, useState } from 'react'
import { loadSavedVoiceURI, speakSafely, utter } from '../lib/voice'

/**
 * Narration for the session, and the flag that drives Aria's beak.
 *
 * Speech is not a convenience in the early band — a child who cannot read the sentence
 * receives the whole task through this. So the hook reports `speaking` honestly from the
 * engine's own events rather than guessing a duration, and it cancels on unmount so a
 * sentence never follows the child onto the next screen.
 */
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    cancelRef.current?.()
    cancelRef.current = null
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const speak = useCallback((text: string) => {
    if (!text || !('speechSynthesis' in window)) return
    stop()
    const u = utter(text, loadSavedVoiceURI())
    u.onstart = () => setSpeaking(true)
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    cancelRef.current = speakSafely(u)
  }, [stop])

  useEffect(() => stop, [stop])

  return { speak, stop, speaking }
}
