import { api, EnrolledSubject, GuidedQuestion, TopicProgress } from '../../api'
import { Band, bandForGrade } from '../band'
import { markStepDone } from '../../lib/steps'
import { AnswerKind, SessionSource, SessionState, StepResult } from '../types'
import { localReply, miss, OPEN_REPLY, praise } from './replies'
import { plain, promptText } from '../text'

/**
 * The real session: one guided question at a time, from the live backend.
 *
 * The child is never asked what to work on. This source picks the topic itself, in the
 * order a teacher would: finish what is already started, then take the next thing that
 * has been unlocked. Everything the old dashboard put in front of the child — mastery
 * percentages, status badges, six activity buttons per topic — is decided here instead
 * and never drawn.
 *
 * It rides on the guided-practice endpoints because that loop already matches the shape
 * of the screen: a prompt, a graded attempt, a hint on a miss, and a worked solution
 * when the child has genuinely stalled. When a server-side session planner exists it
 * replaces this file and nothing above it changes.
 */

/** How many questions make one sitting. Short enough to finish, long enough to matter. */
const SESSION_LENGTH = 5

/**
 * What Aria says to a stuck child before any attempt has been graded.
 *
 * The server has no hint to give until it has seen an answer, so the first "I'm stuck"
 * is answered with method rather than content. The second one reaches the worked
 * solution, on the same schedule as two wrong answers would.
 */
const NUDGE = 'Read it once more and tell me the first thing you can work out. Any part will do.'

/**
 * What Aria says in the senior band, where the problem is already printed above her.
 *
 * Reading the question back would waste the one line she has, so she coaches instead —
 * and the coaching has to match the control the child is about to use. A line about
 * showing your work above a set of four options reads as an app that is not looking at
 * the same screen as the child.
 */
const COACH: Record<AnswerKind, string> = {
  choices: 'Read all four before you commit to one.',
  tiles: 'Read all four before you commit to one.',
  numpad: 'Work it out first, then key in the number.',
  work: 'Show me the step, not just the answer. I will read what you write.',
  text: 'Write what you actually think. I am reading it, not marking it.',
}

/**
 * Chooses the control the child answers with.
 *
 * The band decides more than the question does: the same multiple-choice question is a
 * row of huge coloured tiles for a five-year-old and a column of word cards for a
 * ten-year-old. Where the backend sends no choices we fall back on the safest control
 * for the age — digits for the younger bands, because a keyboard turns a slip into a
 * wrong answer, and written work for the oldest, because that is what is being taught.
 */
export function inferAnswerKind(band: Band, q: { prompt: string; choices: string[] | null }): AnswerKind {
  if (q.choices && q.choices.length > 0) return band === 'early' ? 'tiles' : 'choices'
  if (band === 'senior') {
    return /[=+×÷]|\bsolve\b|\bcalculate\b|\bfind the\b|\bhow many\b/i.test(q.prompt) ? 'work' : 'text'
  }
  if (/\bhow many\b|\bwhat is\b|\btotal\b|\bsum\b|\bproduct\b|\d/.test(q.prompt)) return 'numpad'
  return band === 'early' ? 'numpad' : 'text'
}

/**
 * The topic to teach today.
 *
 * Something already in progress comes first — leaving a half-finished topic behind is
 * how a child ends up with a row of things they nearly know. After that, the first
 * unlocked topic in curriculum order.
 */
export function chooseTopic(progress: TopicProgress[]): TopicProgress | null {
  return progress.find((t) => t.status === 'IN_PROGRESS')
    ?? progress.find((t) => t.status === 'AVAILABLE')
    ?? progress.find((t) => !t.mastered)
    ?? null
}

/**
 * @param gradeId the class the child chose on the picker. A grade rather than a subject
 *   because that is what the progress endpoint takes: one subject at one grade is one
 *   curriculum, and the same child can sit at different grades in different subjects.
 *   Null falls back to the profile's current grade, so a deep link still opens something.
 */
export function createApiSession(userId: string | undefined, gradeId: string | null): SessionSource {
  let band: Band = 'middle'
  let topic: TopicProgress | null = null
  let childName = ''
  let subjectName = ''
  let streak = 0
  let level = 1
  let xpProgress = 0

  let index = 0
  let question: GuidedQuestion | null = null
  let attempt = 0
  let lastHint: string | null = null
  let lastTeach: string | null = null

  const toState = (raw: GuidedQuestion): SessionState => {
    // Clean the model's text before anything reads it, so the answer control and Aria's spoken
    // line work from the same words the child sees. See ../text.ts for why this runs here as
    // well as in the backend's QuestionSanitizer.
    const q: GuidedQuestion = {
      ...raw,
      prompt: promptText(raw.prompt),
      choices: raw.choices ? raw.choices.map((c) => plain(c)) : null,
    }
    const kind = inferAnswerKind(band, q)
    const open = kind === 'text'
    return {
      sessionId: topic?.topicId ?? 'session',
      band,
      childName,
      subject: subjectName,
      focus: topic?.topicName ?? 'Today',
      streak,
      level,
      xpProgress,
      index,
      total: SESSION_LENGTH,
      step: {
        id: q.questionId,
        // The senior layout already prints the problem, so Aria coaches instead of
        // reading it back. The younger bands hear the question itself, because for them
        // the spoken line is the only version they can take in.
        say: band === 'senior' ? COACH[kind] : q.prompt,
        prompt: q.prompt,
        answer: kind,
        choices: q.choices ?? undefined,
        open,
      },
    }
  }

  const load = async (): Promise<SessionState> => {
    if (!topic) throw new Error('No topic is available to work on yet.')
    attempt = 0
    lastHint = null
    lastTeach = null
    question = await api.guidedStart(topic.topicId)
    return toState(question)
  }

  return {
    async start() {
      const me = await api.me()
      childName = me.displayName

      // The chosen class decides both the band and the curriculum. Reading it back from
      // the enrolment list rather than trusting the URL means a stale or hand-edited
      // gradeId lands on a real class instead of an empty session.
      const enrolled = await api.studentSubjects().catch((): EnrolledSubject[] => [])
      const chosen = enrolled.find((s) => s.gradeId === gradeId)
        ?? enrolled.find((s) => s.gradeId === me.currentGradeId)
        ?? enrolled[0]
        ?? null
      subjectName = chosen?.subjectName ?? ''
      band = bandForGrade(chosen?.gradeName ?? me.gradeName)

      const progress = await api.progress(chosen?.gradeId ?? me.currentGradeId ?? undefined)
      topic = chooseTopic(progress)
      if (!topic) {
        throw new Error(subjectName
          ? `There is nothing to work on in ${subjectName} yet.`
          : 'There is nothing assigned yet. Ask a grown-up to add a subject.')
      }

      // Gamification is decoration. A failure here must not stop the lesson.
      try {
        const g = await api.gamification()
        streak = g.streak.current
        level = g.level
        xpProgress = g.xpForNextLevel > 0 ? Math.min(1, g.xpIntoLevel / g.xpForNextLevel) : 0
      } catch { /* the session runs without it */ }

      index = 0
      return load()
    },

    async answer(_stepId, response): Promise<StepResult> {
      if (!question) throw new Error('There is no question on screen.')
      attempt += 1

      // An open written response has no key on the server either. Aria takes the attempt,
      // then shows the thinking behind it — a mark would only teach the child to stop.
      if (inferAnswerKind(band, question) === 'text') {
        const sol = await api.guidedSolution(question.questionId)
        lastTeach = plain(sol.solution ?? sol.correctAnswer)
        markStepDone(userId, topic?.topicId, 'guided')
        return { correct: true, say: OPEN_REPLY, teach: lastTeach }
      }

      const fb = await api.guidedAttempt(question.questionId, response, attempt)
      if (fb.correct) {
        markStepDone(userId, topic?.topicId, 'guided')
        return { correct: true, say: praise(band) }
      }

      lastHint = plain(fb.hint) ?? lastHint
      if (attempt >= 2) {
        // Two honest attempts is the point at which more guessing teaches nothing. Ask
        // the server for the worked solution and let Aria explain it.
        const sol = await api.guidedSolution(question.questionId)
        lastTeach = plain(sol.solution)
          ?? (sol.correctAnswer ? `The answer is ${plain(sol.correctAnswer)}.` : null)
      }
      return { correct: false, say: miss(band), hint: lastHint, teach: lastTeach }
    },

    async hint(_stepId) {
      if (!question) return { hint: null, teach: null }
      attempt += 1
      if (attempt >= 2) {
        const sol = await api.guidedSolution(question.questionId)
        lastTeach = plain(sol.solution)
          ?? (sol.correctAnswer ? `The answer is ${plain(sol.correctAnswer)}.` : null)
      }
      return { hint: lastHint ?? NUDGE, teach: lastTeach }
    },

    async next() {
      if (index >= SESSION_LENGTH - 1) return null
      index += 1
      return load()
    },

    async ask(text) {
      return localReply(text, {
        hint: lastHint,
        teach: lastTeach,
        focus: topic?.topicName ?? 'today',
      })
    },
  }
}
