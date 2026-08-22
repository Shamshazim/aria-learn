import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatTurn, SessionSource, SessionState } from './types'
import { clock } from './sources/replies'
import { useSpeech } from './useSpeech'

/**
 * The whole student session, as one state machine.
 *
 * Every layout renders from this and nothing else. Putting the rules here rather than in
 * the three layouts is what keeps a TK child and an eighth-grader on the same teaching
 * engine: change the number of attempts before Aria explains, and it changes for all of
 * them at once.
 *
 * The rules, in full:
 *   - a wrong answer always earns the hint, in every band, without asking for it;
 *   - after two honest attempts Aria explains, and the child may move on;
 *   - a correct answer earns a star and locks the control, so a child cannot un-win it;
 *   - an open written answer is accepted, never marked, and always followed by the
 *     teaching line.
 */

export type Phase = 'loading' | 'asking' | 'graded' | 'done' | 'error'
export type Mood = 'idle' | 'cheer' | 'think'

/** Attempts a child gets before Aria stops asking and starts explaining. */
const ATTEMPTS_BEFORE_TEACHING = 2

const BLANK = { chosen: null as string | null, value: '', text: '', final: '', rows: [] as string[] }

export function useSession(makeSource: () => SessionSource) {
  const sourceRef = useRef<SessionSource | null>(null)
  const startedRef = useRef(false)
  const moodTimer = useRef<number>(0)

  const [state, setState] = useState<SessionState | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [input, setInput] = useState(BLANK)
  const [verdict, setVerdict] = useState<{ ok: boolean; say: string; teach: string | null } | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [misses, setMisses] = useState(0)
  const [stars, setStars] = useState(0)
  const [mood, setMood] = useState<Mood>('idle')

  const [chat, setChat] = useState<ChatTurn[]>([])
  const [chatOpen, setChatOpen] = useState(false)

  const { speak, stop, speaking } = useSpeech()

  /* The first narration must follow a real click. Speaking a step the child has not
     asked for is both startling and, in Chrome, silently refused for want of a user
     gesture — so a step only reads itself aloud once the child has touched something. */
  const interacted = useRef(false)

  const flash = useCallback((m: Mood) => {
    setMood(m)
    window.clearTimeout(moodTimer.current)
    moodTimer.current = window.setTimeout(() => setMood('idle'), 2200)
  }, [])

  const clearStep = useCallback(() => {
    setInput(BLANK)
    setVerdict(null)
    setHint(null)
    setMisses(0)
  }, [])

  const begin = useCallback(async () => {
    setPhase('loading')
    setError(null)
    clearStep()
    setStars(0)
    setChat([{ from: 'aria', text: 'I am right here. Ask me anything, any time.', at: clock() }])
    try {
      const src = makeSource()
      sourceRef.current = src
      setState(await src.start())
      setPhase('asking')
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }, [makeSource, clearStep])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void begin()
  }, [begin])

  useEffect(() => () => window.clearTimeout(moodTimer.current), [])

  /** The text the current control is offering as an answer. */
  const response = useCallback((): string => {
    if (!state) return ''
    switch (state.step.answer) {
      case 'tiles':
      case 'choices': return input.chosen ?? ''
      case 'numpad': return input.value
      // "x = 5" and "5" are the same answer. The grader should not be the place a child
      // learns that they wrote it in the wrong shape.
      case 'work': return input.final.replace(/^\s*[a-z]\s*=\s*/i, '').trim()
      default: return input.text
    }
  }, [state, input])

  const submit = useCallback(async (given?: string) => {
    const src = sourceRef.current
    if (!src || !state || busy) return
    const answer = (given ?? response()).trim()
    if (!answer) return

    setBusy(true)
    interacted.current = true
    try {
      const r = await src.answer(state.step.id, answer)
      const nextMisses = r.correct ? misses : misses + 1
      setMisses(nextMisses)
      if (r.correct) setStars((s) => s + 1)

      // A miss always surfaces the hint. In the early band there is nowhere to ask for
      // one, and a child who could read a "need a hint?" button would not need it.
      if (!r.correct && r.hint) setHint(r.hint)

      const teach = r.teach ?? null
      setVerdict({ ok: r.correct, say: r.say, teach })
      setPhase('graded')
      flash(r.correct ? 'cheer' : 'think')
      speak(teach ? `${r.say} ${teach}` : r.say)
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    } finally {
      setBusy(false)
    }
  }, [state, busy, response, misses, flash, speak])

  /** For tiles and word cards the tap IS the answer — there is no confirm step. */
  const pick = useCallback((v: string) => {
    if (phase === 'graded' && verdict?.ok) return
    setInput((i) => ({ ...i, chosen: v }))
    void submit(v)
  }, [phase, verdict, submit])

  const advance = useCallback(async () => {
    const src = sourceRef.current
    if (!src || busy) return
    setBusy(true)
    interacted.current = true
    stop()
    // Writing the next question is a model call and takes seconds. Leaving the answered
    // step on screen with a dead button reads as a broken app, so say what is happening.
    setPhase('loading')
    try {
      const s = await src.next()
      if (!s) { setPhase('done'); return }
      clearStep()
      setState(s)
      setPhase('asking')
      if (interacted.current) speak(s.step.say)
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    } finally {
      setBusy(false)
    }
  }, [busy, clearStep, speak, stop])

  const askAria = useCallback(async (text: string) => {
    const src = sourceRef.current
    if (!src || !text.trim()) return
    interacted.current = true
    setChat((c) => [...c, { from: 'child', text: text.trim(), at: clock() }])
    try {
      const reply = await src.ask(text.trim())
      setChat((c) => [...c, { from: 'aria', text: reply, at: clock() }])
      speak(reply)
    } catch {
      setChat((c) => [...c, {
        from: 'aria',
        text: 'I could not reach my notes just then. Try asking me once more.',
        at: clock(),
      }])
    }
  }, [speak])

  /** Puts a line from Aria into the conversation without a question preceding it. */
  const ariaSays = useCallback((text: string) => {
    setChat((c) => [...c, { from: 'aria', text, at: clock() }])
  }, [])

  const sayStep = useCallback(() => {
    interacted.current = true
    if (state) speak(state.step.say)
  }, [state, speak])

  /**
   * "I'm stuck". Costs an attempt, exactly as a wrong answer does.
   *
   * Free hints turn into a way of skipping the thinking, so the child who asks reaches
   * the explanation on the same schedule as the child who tried and missed.
   */
  const askForHint = useCallback(async () => {
    const src = sourceRef.current
    if (!src || !state || busy) return
    interacted.current = true
    setBusy(true)
    try {
      const r = await src.hint(state.step.id)
      setMisses((m) => m + 1)
      if (r.hint) { setHint(r.hint); speak(r.hint) }
      if (r.teach && misses + 1 >= ATTEMPTS_BEFORE_TEACHING) {
        setVerdict({ ok: false, say: 'Let me walk you through it.', teach: r.teach })
        setPhase('graded')
      }
    } catch {
      setHint('Read the question once more and tell me the first thing you notice.')
    } finally {
      setBusy(false)
    }
  }, [state, busy, misses, speak])

  const graded = phase === 'graded'
  const locked = graded && !!verdict?.ok
  const canAdvance = graded && (!!verdict?.ok || misses >= ATTEMPTS_BEFORE_TEACHING)

  return {
    state, phase, error, busy, stars, misses, hint, verdict, mood, speaking,
    input, setInput,
    chat, chatOpen, setChatOpen,
    graded, locked, canAdvance,
    submit, pick, advance, askAria, ariaSays, sayStep, askForHint, restart: begin,
  }
}

export type Session = ReturnType<typeof useSession>
