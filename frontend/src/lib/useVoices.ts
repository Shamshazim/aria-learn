import { useEffect, useState } from 'react'

/**
 * The installed speech voices.
 *
 * Chrome populates the list asynchronously and returns an empty array on the first
 * call, so anything that picks a voice must react to `voiceschanged` rather than
 * reading `getVoices()` once at startup.
 */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  return voices
}
