import { Band } from '../band'

/**
 * Aria's short reactions, and the temporary router behind "Ask Aria".
 *
 * The wording is split by band because the same sentence cannot serve both ends: a
 * six-year-old needs four words and an exclamation, and a thirteen-year-old reads the
 * same line as being talked down to.
 */

const PRAISE = ['Exactly right.', 'That is it.', 'Well done — you had it.', 'Correct. Nice thinking.']
const PRAISE_EARLY = ['Yes! 🎉', 'You got it!', 'That is right!', 'Great counting!']
const MISS = ['Not quite. Look at it once more with me.', 'Close. Try again, slowly.', 'Not yet. Have another go.']
const MISS_EARLY = ['Try again!', 'Not that one. Look again.', 'Have another go!']

const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)]

export const praise = (band: Band) => pick(band === 'early' ? PRAISE_EARLY : PRAISE)
export const miss = (band: Band) => pick(band === 'early' ? MISS_EARLY : MISS)

export const OPEN_REPLY = 'Good — you committed to a reading. Here is the part worth noticing.'

export const clock = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/**
 * Answers a child's question from what Aria already knows about the step in front of her.
 *
 * This is deliberately a local router, not a model call. There is no session chat
 * endpoint on the server yet, and a child asking "I'm stuck" during a lesson must get an
 * answer in the same second — so until `POST /student/session/ask` exists, the hint and
 * the explanation the grader already returned are the honest material to reply with.
 *
 * Replace the body of this function with the endpoint. Nothing else has to change.
 */
export function localReply(text: string, ctx: { hint?: string | null; teach?: string | null; focus: string }): string {
  const t = text.toLowerCase()
  const hint = ctx.hint ?? 'Read the question once more and tell me the first thing you notice.'
  if (/hint|help|stuck|dont know|don't know|idk|confused/.test(t)) return hint
  if (/^why|how come|explain|what does/.test(t)) return ctx.teach ?? hint
  if (/answer|tell me/.test(t)) return `I will not hand it over — but I will walk you to it. ${hint}`
  if (/^(hi|hello|hey)\b/.test(t)) return `Hello. We are on ${ctx.focus.toLowerCase()} today.`
  return 'Good question. Try the first part on your own and tell me what you get.'
}
