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

/** Builds a configured utterance. Callers attach their own onend/onerror. */
export function utter(text: string, voice?: SpeechSynthesisVoice): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text)
  if (voice) u.voice = voice
  u.rate = CALM.rate
  u.pitch = CALM.pitch
  u.volume = CALM.volume
  return u
}
