import { api } from '../api'

/**
 * Narration rendered by the backend and played as ordinary audio.
 *
 * The browser's speech synthesis turned out to be unusable on at least one machine —
 * Chrome reported itself speaking while emitting no sound, through every workaround the
 * Web Speech API allows. An <audio> element has no such failure mode, so when the server
 * can render speech this is used in preference, and browser speech becomes the fallback
 * for platforms where it can't.
 */

/** A narrator the backend can actually render with. */
export interface ServerVoice { name: string; locale: string }

const VOICE_KEY = 'aria.serverVoice'

let cached: { available: boolean; defaultVoice: string; voices: ServerVoice[] } | null = null

/** The chosen macOS voice, remembered per family. */
export function loadServerVoice(): string | null {
  try { return localStorage.getItem(VOICE_KEY) } catch { return null }
}

export function saveServerVoice(name: string) {
  try { localStorage.setItem(VOICE_KEY, name) } catch { /* private mode */ }
}

/** Whether the backend can render narration. Asked once per session. */
export async function speechStatus() {
  if (cached) return cached
  try {
    cached = await api.speechStatus()
  } catch {
    cached = { available: false, defaultVoice: '', voices: [] }
  }
  return cached
}

/** Object URLs are reused across replays, so stepping back and forth costs nothing. */
const audioCache = new Map<string, string>()

async function audioUrl(text: string, voice?: string): Promise<string> {
  const key = `${voice ?? ''}|${text}`
  const hit = audioCache.get(key)
  if (hit) return hit

  const blob = await api.speak(text, voice)
  const url = URL.createObjectURL(blob)
  audioCache.set(key, url)
  return url
}

export interface SpeechHandle {
  /** Stops playback and detaches the handlers. */
  stop: () => void
}

/**
 * Speaks text through the server-rendered audio path.
 *
 * onEnd fires when playback finishes; onFail fires if the audio could not be fetched or
 * played at all, so the caller can fall back to browser speech rather than going silent.
 */
export function speakViaServer(
  text: string,
  voice: string | undefined,
  onEnd: () => void,
  onFail: () => void,
): SpeechHandle {
  let stopped = false
  let el: HTMLAudioElement | null = null

  audioUrl(text, voice)
    .then((url) => {
      if (stopped) return
      el = new Audio(url)
      el.onended = () => { if (!stopped) onEnd() }
      el.onerror = () => { if (!stopped) onFail() }
      // play() rejects when the browser withholds autoplay permission; treat that as a
      // failure so narration falls back instead of silently stalling.
      el.play().catch(() => { if (!stopped) onFail() })
    })
    .catch(() => { if (!stopped) onFail() })

  return {
    stop: () => {
      stopped = true
      if (el) { el.pause(); el.onended = null; el.onerror = null }
    },
  }
}
