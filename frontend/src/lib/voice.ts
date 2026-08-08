/**
 * Voice selection for Aria's narration.
 *
 * The browser's default speech voice is often one of the old compact system voices
 * (Albert, Fred, Ralph…) or, on macOS, a novelty voice — robotic and grating for a
 * child listening to a whole lesson. Nothing in the app used to set `utterance.voice`
 * at all, so that default is exactly what played.
 *
 * This module scores the installed voices and picks the calmest, most natural one
 * available, filters the joke voices out of the picker entirely, and remembers the
 * family's choice.
 */

const STORAGE_KEY = 'aria.voiceURI'

/** Novelty and legacy-robotic voices — never auto-picked, never offered. */
const BLOCKED = [
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'deranged',
  'fred', 'good news', 'hysterical', 'jester', 'junior', 'kathy', 'organ', 'pipe organ',
  'princess', 'ralph', 'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox',
  'grandma', 'grandpa', 'rocko', 'shelley', 'sandy', 'flo', 'eddy', 'reed',
]

/**
 * Voices that actually sound like a person, best first. Enhanced/Premium variants of
 * these are preferred automatically by the scorer below.
 */
const PREFERRED = [
  'ava', 'samantha', 'allison', 'susan', 'serena', 'zoe', 'joelle', 'nicky',
  'google us english', 'google uk english female',
  'microsoft aria', 'microsoft jenny', 'microsoft sonia', 'microsoft michelle',
  'karen', 'moira', 'fiona', 'tessa', 'catherine',
  'daniel', 'oliver', 'alex', 'tom', 'google uk english male',
]

const norm = (v: SpeechSynthesisVoice) => v.name.toLowerCase()

export function isBlocked(v: SpeechSynthesisVoice): boolean {
  const n = norm(v)
  return BLOCKED.some((b) => n === b || n.startsWith(b + ' ') || n.startsWith(b + '('))
}

/** Higher is better. Used both to auto-pick and to order the picker. */
export function score(v: SpeechSynthesisVoice): number {
  if (isBlocked(v)) return -1000
  const n = norm(v)
  let s = 0

  // Apple's Enhanced/Premium downloads and the Microsoft/Google neural voices are
  // the genuinely human-sounding tier and are worth far more than any name match.
  if (/premium|enhanced|neural|natural/.test(n)) s += 120
  if (/\(premium\)/.test(n)) s += 20

  const pi = PREFERRED.findIndex((p) => n.startsWith(p))
  if (pi >= 0) s += 70 - pi

  // Network voices in Chrome ("Google …") are usually better than local compact ones.
  if (!v.localService) s += 25

  const lang = (v.lang || '').toLowerCase()
  if (lang.startsWith('en-us')) s += 15
  else if (lang.startsWith('en-gb') || lang.startsWith('en-au')) s += 12
  else if (lang.startsWith('en')) s += 8
  else s -= 60 // a non-English voice reading English is the worst option of all

  return s
}

/** English, non-novelty voices, best first — what the picker should show. */
export function usableVoices(all: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return all
    .filter((v) => (v.lang || '').toLowerCase().startsWith('en') && !isBlocked(v))
    .sort((a, b) => score(b) - score(a))
}

export function loadSavedVoiceURI(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

export function saveVoiceURI(uri: string) {
  try { localStorage.setItem(STORAGE_KEY, uri) } catch { /* private mode — not worth surfacing */ }
}

/** The family's saved voice if it's still installed, otherwise the best available. */
export function chooseVoice(all: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const usable = usableVoices(all)
  if (!usable.length) return undefined
  const saved = loadSavedVoiceURI()
  return usable.find((v) => v.voiceURI === saved) ?? usable[0]
}

/**
 * Calm, unhurried delivery. Pitch stays at 1.0 — the old 1.15 pushed the voice up
 * into a shrill register, which is most of what made it grating over a full lesson.
 */
export const CALM = { rate: 0.9, pitch: 1.0, volume: 1.0 }

/**
 * Speaks an utterance without tripping over Chrome's teardown window.
 *
 * speak() issued while the engine is still winding down a cancel() is silently
 * dropped, and the engine can stay wedged afterwards — which is what made Aria go
 * quiet for the rest of a lesson once the voice was changed. Rather than guessing a
 * fixed delay, this cancels only if something is actually in flight and then waits for
 * the engine to report itself genuinely idle before speaking.
 *
 * Returns a canceller so callers can abandon a queued utterance.
 */
export function speakSafely(u: SpeechSynthesisUtterance): () => void {
  const s = window.speechSynthesis
  let abandoned = false
  let timer = 0
  let waited = 0

  /*
   * Speak in this very tick when the engine is free. Chrome refuses speak() that isn't
   * tied to a user gesture ("not allowed since M71"), and a gesture only carries through
   * the current task — deferring every utterance into a timeout, as this used to, drops
   * that activation and the engine simply stays silent.
   */
  if (!s.speaking && !s.pending) {
    s.speak(u)
    return () => { abandoned = true }
  }

  // Busy: the utterance in flight has to be stopped and the engine allowed to settle,
  // which unavoidably costs us the current task. Priming on the gesture covers this.
  s.cancel()
  const attempt = () => {
    if (abandoned) return
    if ((s.speaking || s.pending) && waited < 800) {
      waited += 50
      timer = window.setTimeout(attempt, 50)
      return
    }
    s.speak(u)
  }
  timer = window.setTimeout(attempt, 60)
  return () => { abandoned = true; clearTimeout(timer) }
}

/**
 * Unlocks the speech engine from inside a real click.
 *
 * Aria's narration is started by an effect, which runs in a later task than the click
 * that triggered it, so it carries no user activation of its own. Speaking a silent
 * utterance synchronously in the handler marks the engine as user-activated for the
 * rest of the session, after which the walkthrough can speak freely.
 *
 * Must be called directly inside an event handler — deferring it defeats the purpose.
 */
export function primeSpeech() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    const silent = new SpeechSynthesisUtterance('')
    silent.volume = 0
    window.speechSynthesis.speak(silent)
  } catch { /* nothing to do if the engine refuses; playback still tries */ }
}

/**
 * Resolves a voice from the engine at the moment it's needed.
 *
 * Voice objects are looked up fresh rather than held, because a SpeechSynthesisVoice
 * kept in React state across a voice-list refresh can stop being one the engine will
 * accept, and an utterance carrying a voice the engine rejects simply makes no sound.
 */
export function resolveVoice(voiceURI?: string | null): SpeechSynthesisVoice | undefined {
  if (!voiceURI || typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined
  return window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceURI)
}

/**
 * Builds a configured utterance. Callers attach their own onend/onerror.
 *
 * Takes a voiceURI rather than a voice object. When it can't be resolved the utterance
 * is left with no voice at all, which falls back to the browser default — silent
 * narration is far worse than narration in the wrong voice.
 */
export function utter(text: string, voiceURI?: string | null): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text)
  const v = resolveVoice(voiceURI)
  if (v) u.voice = v
  u.rate = CALM.rate
  u.pitch = CALM.pitch
  u.volume = CALM.volume
  return u
}

/** An utterance with nothing configured but the pacing — the most compatible form. */
export function plainUtter(text: string): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text)
  u.rate = CALM.rate
  u.pitch = CALM.pitch
  return u
}
