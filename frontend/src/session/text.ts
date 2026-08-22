/**
 * Model text, made safe to read.
 *
 * This is the second line of defence, not the first. `QuestionSanitizer.java` strips markup out
 * of every question at generation time, which is where the fix belongs — but rows generated
 * before that gate existed are still in `question_bank`, and a grader hint or worked solution
 * can reach this screen from a path the gate does not cover. A child reading "<br>" is a defect
 * whichever route produced it, so the last thing before the paint cleans it too.
 *
 * It mirrors the backend deliberately: the same break tags become the same line breaks, and the
 * same named tags are removed by name rather than by a generic `<…>` pattern, because a maths
 * prompt legitimately contains "is 3 < 5?" and a generic pattern would eat half the question.
 */

/** Tags the model writes instead of a line break, plus their HTML-escaped spellings. */
const BREAK_TAG = /(?:<|&lt;)\/?(?:br|p|div|li|tr)\s*\/?\s*(?:>|&gt;)/gi

/** The remaining inline tags, removed rather than turned into a break. */
const INLINE_TAG =
  /(?:<|&lt;)\/?(?:span|b|i|u|em|strong|ul|ol|table|td|th|code|pre|h[1-6])\s*\/?\s*(?:>|&gt;)/gi

/** A backslash-n that survived as two literal characters through a double-escaped JSON string. */
const LITERAL_NEWLINE = /(?:\\r)?\\n/g

const ENTITIES: Array<[RegExp, string]> = [
  [/&nbsp;/g, ' '],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  [/&amp;/g, '&'],
]

/** One line of readable text: markup gone, whitespace collapsed. */
export function plain(s: string): string
export function plain(s: string | null | undefined): string | null
export function plain(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null
  let out = s.replace(LITERAL_NEWLINE, '\n').replace(BREAK_TAG, '\n').replace(INLINE_TAG, '')
  // Entities last, so a decoded "&lt;" is never re-read as the start of a tag.
  for (const [pattern, char] of ENTITIES) out = out.replace(pattern, char)
  return out.replace(/\s+/g, ' ').trim()
}

/** A whole line that is only an option: "A) …", "(b. …". Used to strip options from a prompt. */
const OPTION_LINE = /^\s*\(?[A-Da-d][).:-]\s*\S/

/**
 * A prompt with any options the model duplicated into it removed.
 *
 * Only lines that are *nothing but* an option go. A prompt that merely mentions "A)" mid-sentence
 * keeps it, and a prompt that is entirely option lines is returned whole rather than emptied —
 * an unreadable question still beats a blank one.
 */
export function promptText(s: string | null | undefined): string {
  if (!s) return ''
  const broken = (s.match(LITERAL_NEWLINE) || s.match(BREAK_TAG) || s.includes('\n'))
    ? s.replace(LITERAL_NEWLINE, '\n').replace(BREAK_TAG, '\n')
    : s
  const kept = broken.split('\n').filter((line) => !OPTION_LINE.test(line))
  const text = plain(kept.join('\n'))
  return text || plain(s)
}
