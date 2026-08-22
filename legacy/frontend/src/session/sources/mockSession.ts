import { Band } from '../band'
import { SessionSource, SessionState, StepResult } from '../types'
import { MOCK, MockSubject, MockStep } from './mockContent'
import { localReply, miss, OPEN_REPLY, praise } from './replies'

/**
 * A scripted session. Used by demo mode (`/student?demo=1`).
 *
 * It answers on a short delay so the loading and speaking states are visible, and it
 * never touches the network — which is what makes it the right thing to show when the
 * local AI engine is not running.
 */

const WHO: Record<Band, { name: string; streak: number }> = {
  early: { name: 'Mia', streak: 7 },
  middle: { name: 'Noah', streak: 12 },
  senior: { name: 'Sofia', streak: 31 },
}

/** Demo mode has no enrolment record, so the class name is scripted with the rest of it. */
const SUBJECT_NAME: Record<MockSubject, string> = {
  math: 'Math', reading: 'Reading', science: 'Science',
}

const wait = <T,>(v: T, ms = 350) => new Promise<T>((r) => setTimeout(() => r(v), ms))

export function createMockSession(band: Band, subject: MockSubject): SessionSource {
  const script = MOCK[band][subject]
  let index = 0
  let misses = 0

  const current = (): MockStep => script.steps[index]

  const state = (): SessionState => {
    const st = current()
    return {
      sessionId: 'demo',
      band,
      childName: WHO[band].name,
      subject: SUBJECT_NAME[subject],
      focus: script.focus,
      streak: WHO[band].streak,
      level: 6,
      xpProgress: 0.6,
      index,
      total: script.steps.length,
      step: {
        id: `${band}-${subject}-${index}`,
        say: st.say,
        prompt: st.prompt,
        visual: st.visual,
        answer: st.answer,
        choices: st.choices,
        prefill: st.prefill,
        open: st.key === null,
      },
    }
  }

  const reset = () => { misses = 0 }

  return {
    async start() {
      index = 0
      reset()
      return wait(state(), 200)
    },

    async answer(_stepId, response) {
      const st = current()
      const given = response.trim()

      // An open step has no key. Aria accepts the attempt and teaches into it, because
      // marking an interpretation wrong is exactly what stops a child writing again.
      if (st.key === null) {
        return wait<StepResult>({ correct: true, say: OPEN_REPLY, teach: st.teach })
      }

      const ok = given.toLowerCase() === st.key.toLowerCase()
      misses = ok ? 0 : misses + 1
      return wait<StepResult>({
        correct: ok,
        say: ok ? praise(band) : miss(band),
        hint: ok ? null : st.hint,
        teach: !ok && misses >= 2 ? st.teach : null,
      })
    },

    async hint(_stepId) {
      const st = current()
      misses += 1
      return wait({ hint: st.hint, teach: misses >= 2 ? st.teach : null }, 250)
    },

    async next() {
      if (index >= script.steps.length - 1) return wait(null, 150)
      index += 1
      reset()
      return wait(state(), 200)
    },

    async ask(text) {
      const st = current()
      return wait(localReply(text, { hint: st.hint, teach: st.teach, focus: script.focus }), 500)
    },
  }
}
