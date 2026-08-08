import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KnowledgeContent } from '../api'
import { Beat, buildBeats, visualStepCount } from '../lib/lessonBeats'
import AriaTutor from './AriaTutor'
import AnimatedVisual, { usePrefersReducedMotion } from './AnimatedVisual'
import VoicePicker from './VoicePicker'
import { useVoices } from '../lib/useVoices'
import { chooseVoice, saveVoiceURI, usableVoices, utter } from '../lib/voice'

interface TutorLessonProps {
  content: KnowledgeContent
  topicName: string
  /** Fired once the child reaches the end of the walkthrough. */
  onFinish?: () => void
}

/** Fallback pacing when speech synthesis is unavailable or muted. */
function readingMs(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(2200, Math.round((words / 2.6) * 1000))
}

/**
 * Teaches a lesson as a paced walkthrough: Aria narrates one beat at a time while the
 * matching picture builds itself piece by piece beside her.
 *
 * Narration drives the pacing when speech synthesis is available — the next beat starts
 * when she actually finishes speaking, not on a fixed timer — with a minimum dwell so a
 * picture always finishes assembling before the lesson moves on.
 */
export default function TutorLesson({ content, topicName, onFinish }: TutorLessonProps) {
  const beats = useMemo<Beat[]>(() => buildBeats(content, topicName), [content, topicName])
  const reduced = usePrefersReducedMotion()

  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [muted, setMuted] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  const timer = useRef<number | null>(null)
  const watchdog = useRef<number | null>(null)
  const finished = useRef(false)
  const ttsOk = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Narration voice: the family's saved choice, else the best one installed.
  const voices = useVoices()
  const [voiceURI, setVoiceURI] = useState<string | null>(null)
  const voice = useMemo(() => {
    const saved = voiceURI ? usableVoices(voices).find((v) => v.voiceURI === voiceURI) : undefined
    return saved ?? chooseVoice(voices)
  }, [voices, voiceURI])

  /*
   * getVoices() hands back a fresh array on every call, so anything derived from it can
   * change identity without the chosen voice actually changing. The playback effect keys
   * off the stable voiceURI and reads the object through a ref, so a voice-list refresh
   * mid-sentence can't restart the effect and cancel Aria in the middle of a word.
   */
  const voiceRef = useRef<SpeechSynthesisVoice | undefined>(undefined)
  voiceRef.current = voice
  const voiceKey = voice?.voiceURI ?? ''

  const clearTimer = () => {
    if (timer.current !== null) { clearTimeout(timer.current); timer.current = null }
    if (watchdog.current !== null) { clearTimeout(watchdog.current); watchdog.current = null }
  }

  const stopSpeech = useCallback(() => {
    if (ttsOk) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [ttsOk])

  const beat = beats[i]
  const last = i >= beats.length - 1

  /*
   * Not every sentence describes something drawable, and a stage that blanks out
   * between pictures is what makes the walkthrough feel like plain reading. So the
   * most recent picture stays up as context until a new one replaces it — shown
   * complete and dimmed, since it belongs to an earlier beat.
   */
  const stage = useMemo(() => {
    for (let n = i; n >= 0; n--) {
      const v = beats[n].visual
      if (v) return { visual: v, from: n }
    }
    return null
  }, [beats, i])

  const go = useCallback((n: number) => {
    clearTimer()
    stopSpeech()
    setI(Math.max(0, Math.min(n, beats.length - 1)))
  }, [beats.length, stopSpeech])

  // Plays the current beat: speak it, animate the visual, then move on.
  useEffect(() => {
    if (!playing || !beat) return
    let cancelled = false
    const startedAt = Date.now()

    // Hold long enough for the picture to finish assembling.
    const steps = visualStepCount(beat.visual)
    const buildMs = reduced ? 0 : steps * Math.min(400, Math.max(70, Math.round(3500 / Math.max(1, steps)))) + 500
    const minDwell = Math.max(1500, buildMs)

    const advance = () => {
      if (cancelled) return
      const wait = Math.max(0, minDwell - (Date.now() - startedAt))
      timer.current = window.setTimeout(() => {
        if (cancelled) return
        if (last) { setPlaying(false); return }
        setI((n) => n + 1)
      }, wait)
    }

    if (ttsOk && !muted) {
      window.speechSynthesis.cancel()
      const u = utter(beat.say, voiceRef.current)

      // onend must only ever take effect once, whichever path gets there first.
      let done = false
      const finish = () => {
        if (done || cancelled) return
        done = true
        setSpeaking(false)
        advance()
      }
      u.onend = finish
      u.onerror = finish
      setSpeaking(true)
      // Chrome occasionally drops an utterance queued in the same tick as a cancel().
      timer.current = window.setTimeout(() => window.speechSynthesis.speak(u), 60)

      /*
       * Chrome regularly stops speaking without ever firing onend — reproducibly so on
       * longer sentences. Waiting on that event alone froze the walkthrough on the beat
       * with no voice and no way forward, which is what made Aria seem to go mute. If
       * the utterance hasn't reported back well past its expected length, give up on it
       * and carry on rather than stalling.
       */
      watchdog.current = window.setTimeout(finish, readingMs(beat.say) * 1.9 + 1500)
    } else {
      timer.current = window.setTimeout(advance, readingMs(beat.say))
    }

    return () => { cancelled = true; clearTimer(); if (ttsOk) window.speechSynthesis.cancel(); setSpeaking(false) }
  }, [i, playing, muted, beat, last, reduced, ttsOk, voiceKey])

  /*
   * Chrome's speech engine goes quiet part-way through anything longer than roughly
   * fifteen seconds. Nudging resume() while it should be talking keeps it alive; it is
   * a no-op when nothing is paused, so it's safe on engines without the bug.
   */
  useEffect(() => {
    if (!ttsOk || !speaking) return
    const id = window.setInterval(() => {
      if (window.speechSynthesis.speaking) window.speechSynthesis.resume()
    }, 9000)
    return () => clearInterval(id)
  }, [ttsOk, speaking])

  // Never leave speech running when the child navigates away.
  useEffect(() => () => { clearTimer(); if (ttsOk) window.speechSynthesis.cancel() }, [ttsOk])

  useEffect(() => {
    if (last && started && !finished.current) { finished.current = true; onFinish?.() }
  }, [last, started, onFinish])

  /*
   * Changing voice has exactly one audible path, never two competing ones.
   *
   * Mid-lesson, the playback effect keys off voiceKey and re-speaks the current beat in
   * the new voice — one cancel, one speak. Only when nothing is playing does this speak
   * a sample itself, because then no other timer is touching the engine.
   */
  const changeVoice = (uri: string) => {
    setVoiceURI(uri)
    saveVoiceURI(uri)
    if (playing || !ttsOk || muted) return

    clearTimer()
    window.speechSynthesis.cancel()
    const picked = usableVoices(voices).find((v) => v.voiceURI === uri)
    timer.current = window.setTimeout(() => {
      const u = utter("Hi! I'm Aria. Let's learn something together.", picked)
      u.onend = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      setSpeaking(true)
      window.speechSynthesis.speak(u)
    }, 120)
  }

  const start = () => { setStarted(true); setPlaying(true); setI(0); finished.current = false }
  const toggle = () => { if (playing) { clearTimer(); stopSpeech(); setPlaying(false) } else setPlaying(true) }
  const replay = () => { finished.current = false; setStarted(true); go(0); setPlaying(true) }

  if (!beat) return null

  return (
    <section className={`tutor-stage tutor-stage--${beat.kind}`}>
      <div className="tutor-stage__row">
        <div className="tutor-stage__aria">
          <AriaTutor mood={started ? beat.mood : 'idle'} speaking={speaking} size={150} />
        </div>

        <div className="tutor-bubble">
          {!started ? (
            <>
              <p className="tutor-bubble__text">
                Hi! I'm Aria. Want me to <strong>show you</strong> {topicName}? I'll go step by step.
              </p>
              <button className="btn tutor-start" onClick={start}>▶ Teach me!</button>
            </>
          ) : (
            <p className="tutor-bubble__text" aria-live="polite">{beat.say}</p>
          )}
        </div>
      </div>

      {started && stage && (
        <div className={`tutor-stage__visual ${stage.from === i ? '' : 'is-carried'}`}>
          {/* Keyed on the beat that owns the picture, so carrying it forward doesn't replay it. */}
          {/* On a picture beat, Aria is already saying the caption — don't print it twice. */}
          <AnimatedVisual
            key={stage.from}
            visual={stage.visual}
            playing={playing && stage.from === i}
            showCaption={stage.visual.caption !== beats[stage.from].say}
          />
        </div>
      )}

      {started && (
        <>
          <div className="tutor-controls">
            <button className="btn btn--ghost" onClick={() => go(i - 1)} disabled={i === 0}>⏮ Back</button>
            <button className="btn tutor-play" onClick={toggle}>
              {playing ? '⏸ Pause' : (last ? '↻ Again' : '▶ Play')}
            </button>
            <button className="btn btn--ghost" onClick={() => go(i + 1)} disabled={last}>Next ⏭</button>
            {/* Labelled with what the click does, not with the current state — reading
                "Voice on" as a status and clicking it to enable sound muted Aria instead. */}
            <button
              className={`btn btn--ghost ${muted ? 'is-muted' : ''}`}
              onClick={() => { setMuted((m) => !m); stopSpeech() }}
              aria-pressed={muted}
              title={muted ? 'Aria is silent — turn her voice back on' : 'Mute Aria’s voice'}
            >
              {muted ? '🔇 Unmute Aria' : '🔊 Mute Aria'}
            </button>
            {last && <button className="btn btn--ghost" onClick={replay}>↺ Watch again</button>}
          </div>

          {!muted && (
            <VoicePicker voices={voices} value={voice} onChange={changeVoice} />
          )}

          <div className="tutor-track" role="group" aria-label="Lesson steps">
            {beats.map((b, n) => (
              <button
                key={n}
                type="button"
                className={`tutor-tick ${n === i ? 'is-now' : ''} ${n < i ? 'is-done' : ''}`}
                title={b.label}
                aria-label={`Step ${n + 1}: ${b.label}`}
                onClick={() => go(n)}
              />
            ))}
          </div>

          <p className="tutor-count muted">Step {i + 1} of {beats.length}</p>
        </>
      )}
    </section>
  )
}
