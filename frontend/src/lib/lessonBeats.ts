import { KnowledgeContent, Visual } from '../api'
import { inferVisual } from './inferVisual'

/** How Aria is drawn and animated while a beat plays. */
export type TutorMood = 'idle' | 'talking' | 'pointing' | 'thinking' | 'cheering'

/**
 * One teaching beat — a single thing Aria says, optionally alongside a picture she
 * builds up while saying it. A lesson is taught as a sequence of these instead of
 * being dumped on the child as one wall of text.
 */
export interface Beat {
  kind: 'intro' | 'explain' | 'visual' | 'example' | 'mistake' | 'tip' | 'recap'
  /** What Aria narrates (and what shows in the speech bubble). */
  say: string
  /** Picture animated during this beat, if any. */
  visual?: Visual
  mood: TutorMood
  /** Short label for the progress dots' tooltip. */
  label: string
}

/**
 * Splits prose into sentences without breaking decimals ("0.5"), so narration
 * pauses where a teacher would. Avoids lookbehind for older Safari.
 */
function sentences(text: string): string[] {
  const out: string[] = []
  let buf = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    buf += ch
    if (ch === '.' || ch === '!' || ch === '?') {
      // A period surrounded by digits is a decimal point, not a full stop.
      const prev = text[i - 1]
      const next = text[i + 1]
      const isDecimal = ch === '.' && /\d/.test(prev ?? '') && /\d/.test(next ?? '')
      if (!isDecimal && (next === undefined || /\s/.test(next))) {
        out.push(buf.trim())
        buf = ''
      }
    }
  }
  if (buf.trim()) out.push(buf.trim())

  // Glue very short fragments onto the previous beat so narration isn't choppy.
  return out.reduce<string[]>((acc, s) => {
    if (acc.length && s.length < 30) acc[acc.length - 1] += ' ' + s
    else acc.push(s)
    return acc
  }, [])
}

/**
 * Turns a generated lesson into a paced sequence of beats.
 *
 * Visuals are interleaved into the explanation rather than shown in a block at the
 * end, so a picture lands while the idea it illustrates is still being said.
 */
export function buildBeats(content: KnowledgeContent, topicName: string): Beat[] {
  const beats: Beat[] = []

  beats.push({
    kind: 'intro',
    say: `Let's learn about ${topicName}! Follow along with me.`,
    mood: 'cheering',
    label: 'Hello',
  })

  const parts = sentences(content.explanation ?? '')
  const visuals = (content.visuals ?? []).filter((v) => v?.type || v?.caption)

  // Spread the pictures evenly through the explanation instead of clumping them.
  const gap = visuals.length ? Math.max(1, Math.floor(parts.length / visuals.length)) : 0
  let vi = 0

  parts.forEach((s, i) => {
    // Draw whatever this sentence describes, so the beat isn't just Aria talking.
    const drawn = inferVisual(s)
    beats.push({
      kind: 'explain',
      say: s,
      visual: drawn ?? undefined,
      mood: drawn ? 'pointing' : 'talking',
      label: `Step ${i + 1}`,
    })
    if (vi < visuals.length && gap && (i + 1) % gap === 0) {
      const v = visuals[vi++]
      beats.push({
        kind: 'visual',
        say: v.caption || 'Look at this picture.',
        visual: v,
        mood: 'pointing',
        label: 'Picture',
      })
    }
  })

  // Any pictures left over (short explanation, several visuals) still get shown.
  while (vi < visuals.length) {
    const v = visuals[vi++]
    beats.push({
      kind: 'visual',
      say: v.caption || 'Look at this picture.',
      visual: v,
      mood: 'pointing',
      label: 'Picture',
    })
  }

  // Examples, mistakes and tips are just as often about a concrete quantity, so they
  // get a drawn picture on the same terms as the explanation.
  ;(content.realWorldExamples ?? []).forEach((e) =>
    beats.push({ kind: 'example', say: `Here's one from real life. ${e}`,
                 visual: inferVisual(e) ?? undefined, mood: 'talking', label: 'Real life' }))

  ;(content.commonMistakes ?? []).forEach((m) =>
    beats.push({ kind: 'mistake', say: `Watch out for this. ${m}`,
                 visual: inferVisual(m) ?? undefined, mood: 'thinking', label: 'Watch out' }))

  ;(content.tips ?? []).forEach((t) =>
    beats.push({ kind: 'tip', say: `Here's a tip. ${t}`,
                 visual: inferVisual(t) ?? undefined, mood: 'pointing', label: 'Tip' }))

  if (content.summary) {
    beats.push({ kind: 'recap', say: `Let's recap. ${content.summary}`, mood: 'cheering', label: 'Recap' })
  }

  beats.push({
    kind: 'recap',
    say: "Great job following along! You're ready to try some yourself.",
    mood: 'cheering',
    label: 'Done',
  })

  return beats
}

/** Roughly how many things a visual draws — used to pace its build-up animation. */
export function visualStepCount(v: Visual | undefined): number {
  if (!v) return 0
  const t = (v.type ?? '').toLowerCase()
  if (t === 'groups') return Math.min(v.groups ?? 0, 12) * Math.min(v.itemsPerGroup ?? 0, 20)
  if (t === 'array') return Math.min(v.rows ?? 0, 15) * Math.min(v.cols ?? 0, 15)
  if (t === 'numberline') return (v.jumps ?? []).length
  if (t === 'fractionbar') return Math.max(0, Math.min(v.shaded ?? 0, v.parts ?? 0))
  if (t === 'shape') return 1
  if (t === 'tenframe') return (v.filled ?? 0) + (v.ones ?? 0)
  if (t === 'baseten') return (v.hundreds ?? 0) + (v.tens ?? 0) + (v.ones ?? 0)
  if (t === 'numberbond') return 3
  if (t === 'comparison') return 2
  if (t === 'clock') return 2
  if (t === 'tally') return Math.min(v.count ?? 0, 30)
  if (t === 'equation' || t === 'wordcards') return (v.terms ?? []).length
  return 0
}
