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
  const finished = useRef(false)
  const ttsOk = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Narration voice: the family's saved choice, else the best one installed.
  const voices = useVoices()
  const [voiceURI, setVoiceURI] = useState<string | null>(null)
  const voice = useMemo(() => {
    const saved = voiceURI ? usableVoices(voices).find((v) => v.voiceURI === voiceURI) : undefined
    return saved ?? chooseVoice(voices)
  }, [voices, voiceURI])

  const clearTimer = () => {
    if (timer.current !== null) { clearTimeout(timer.current); timer.current = null }
  }

  const stopSpeech = useCallback(() => {
    if (ttsOk) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [ttsOk])

  const beat = beats[i]
  const last = i >= beats.length - 1

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
      const u = utter(beat.say, voice)
      u.onend = () => { if (!cancelled) { setSpeaking(false); advance() } }
      u.onerror = () => { if (!cancelled) { setSpeaking(false); advance() } }
      setSpeaking(true)
      // Chrome occasionally drops an utterance queued in the same tick as a cancel().
      timer.current = window.setTimeout(() => window.speechSynthesis.speak(u), 60)
    } else {
      timer.current = window.setTimeout(advance, readingMs(beat.say))
    }

    return () => { cancelled = true; clearTimer(); if (ttsOk) window.speechSynthesis.cancel(); setSpeaking(false) }
  }, [i, playing, muted, beat, last, reduced, ttsOk, voice])

  // Never leave speech running when the child navigates away.
  useEffect(() => () => { clearTimer(); if (ttsOk) window.speechSynthesis.cancel() }, [ttsOk])

  useEffect(() => {
    if (last && started && !finished.current) { finished.current = true; onFinish?.() }
  }, [last, started, onFinish])

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

      {started && beat.visual && (
        <div className="tutor-stage__visual">
          <AnimatedVisual key={i} visual={beat.visual} playing={playing} />
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
            <button
              className="btn btn--ghost"
              onClick={() => { setMuted((m) => !m); stopSpeech() }}
              title={muted ? 'Turn Aria’s voice on' : 'Turn Aria’s voice off'}
            >
              {muted ? '🔇 Voice off' : '🔊 Voice on'}
            </button>
            {last && <button className="btn btn--ghost" onClick={replay}>↺ Watch again</button>}
          </div>

          {!muted && (
            <VoicePicker
              voices={voices}
              value={voice}
              onChange={(uri) => { setVoiceURI(uri); saveVoiceURI(uri) }}
            />
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
