import { Band } from './band'

/**
 * The contract between the student session UI and whatever decides what to teach.
 *
 * The UI never chooses a topic, an activity or a difficulty. It renders the one step it
 * is handed and reports what the child did. That keeps every decision on the side that
 * holds the record of the child, and it lets the planner change without touching a
 * single component.
 */

/** A picture that carries the task. Declarative, so each band can draw it its own way. */
export type StepVisual =
  | { kind: 'items'; item: 'apple' | 'star' | 'block'; count: number }
  | { kind: 'groups'; groups: number; per: number }

/**
 * How the child answers. Exactly one control per step — never two at once.
 *
 * `tiles`   huge tap targets, for a child who cannot read (early band)
 * `choices` word cards, for a reader picking between phrases
 * `numpad`  digits only, so a wrong answer is wrong thinking and never a typo
 * `work`    numbered working rows plus a final answer (senior band)
 * `text`    a written response Aria reads and teaches into, rather than marks
 */
export type AnswerKind = 'tiles' | 'choices' | 'numpad' | 'work' | 'text'

export interface SessionStep {
  id: string
  /** What Aria says out loud. In the early band the child may never read it. */
  say: string
  /** The problem in writing. The older bands show it; the early band does not. */
  prompt?: string
  visual?: StepVisual
  answer: AnswerKind
  /** Faces for `tiles` and `choices`. */
  choices?: string[]
  /** Working rows already filled in, so a stuck child starts from a real first line. */
  prefill?: string[]
  /**
   * True when there is no single right answer — a written interpretation, for example.
   * Marking one of those wrong is exactly what stops a child writing again, so Aria
   * accepts the attempt and teaches into it instead.
   */
  open?: boolean
}

/** What came back after the child answered. */
export interface StepResult {
  correct: boolean
  /** Aria's reply, in her own voice. Never a raw grader message. */
  say: string
  /** Offered after a miss. Points at the method, never at the answer. */
  hint?: string | null
  /** The explanation. Shown after a second miss, or after any open answer. */
  teach?: string | null
}

/** One turn of the child-to-Aria conversation. */
export interface ChatTurn {
  from: 'aria' | 'child'
  text: string
  at: string
}

export interface SessionState {
  sessionId: string
  band: Band
  childName: string
  /** The class the child picked. Shown so they can see they are where they meant to be. */
  subject: string
  /** Shown to the older bands as "Today's focus". The early band never sees it. */
  focus: string
  streak: number
  level: number
  /** 0 to 1. Drawn as dots or as a segmented bar — never as a percent. */
  xpProgress: number
  step: SessionStep
  index: number
  total: number
}

/**
 * Everything the session UI needs from the outside world.
 *
 * Two implementations exist: `createApiSession` talks to the real backend, and
 * `createMockSession` runs a scripted session so the three layouts can be reviewed
 * without the AI engine. Both satisfy these four calls, and no component knows which
 * one it is talking to.
 */
export interface SessionSource {
  start(): Promise<SessionState>
  answer(stepId: string, response: string): Promise<StepResult>
  /**
   * What Aria offers a child who says they are stuck.
   *
   * It is a separate call rather than a graded empty answer, because an empty string is
   * not an attempt and the grader should never have to pretend it is. It still costs an
   * attempt: a free hint turns into a way of skipping the thinking.
   */
  hint(stepId: string): Promise<{ hint: string | null; teach: string | null }>
  /** The next step, or null when the session is finished. */
  next(): Promise<SessionState | null>
  ask(text: string): Promise<string>
}
