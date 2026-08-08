import { Visual } from '../api'

/**
 * Builds a picture out of a sentence of lesson text.
 *
 * Generated lessons carry only ~1.2 visuals each, so on their own barely a tenth of
 * the walkthrough's beats had anything to look at — the rest was Aria talking. Most
 * sentences in a maths lesson do describe something showable ("3 groups of 4",
 * "half past two", "4 tens and 2 ones"), so this reads each beat and draws it.
 *
 * Returns null when a sentence has nothing concrete in it; the beat then just gets
 * narrated, as before.
 */

const NUM_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
}

/** Digits or number words, so "three groups of four" works as well as "3 groups of 4". */
function num(raw: string | undefined): number | null {
  if (!raw) return null
  const t = raw.trim().toLowerCase()
  if (/^\d+$/.test(t)) return parseInt(t, 10)
  return NUM_WORDS[t] ?? null
}

const N = '(\\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)'

/** Emoji for "groups" visuals, chosen from whatever the sentence is talking about. */
function emojiFor(text: string): string {
  const t = text.toLowerCase()
  // Anchored on word boundaries — an unanchored /car/ matches "carry" and "cards",
  // which is how a lesson about carrying over ended up illustrated with cars.
  const table: [RegExp, string][] = [
    [/\bapples?\b/, '🍎'], [/\boranges?\b/, '🍊'], [/\bbananas?\b/, '🍌'],
    [/\bcookies?\b|\bbiscuits?\b/, '🍪'], [/\bcand(y|ies)\b|\bsweets?\b|\blollipops?\b/, '🍬'],
    [/\bcakes?\b|\bcupcakes?\b/, '🧁'], [/\bpizzas?\b/, '🍕'], [/\bstars?\b/, '⭐'],
    [/\bflowers?\b/, '🌸'], [/\btrees?\b/, '🌳'], [/\bballs?\b/, '⚽'],
    [/\bcars?\b/, '🚗'], [/\bbooks?\b/, '📚'], [/\bpencils?\b/, '✏️'],
    [/\bmarbles?\b/, '🔵'], [/\bdogs?\b|\bpupp(y|ies)\b/, '🐶'],
    [/\bcats?\b|\bkittens?\b/, '🐱'], [/\bfish\b/, '🐟'], [/\bbirds?\b/, '🐦'],
    [/\bducks?\b/, '🦆'], [/\bsheep\b/, '🐑'], [/\bcows?\b/, '🐄'], [/\beggs?\b/, '🥚'],
    [/\bcoins?\b|\bpenn(y|ies)\b|\bcents?\b|\bdollars?\b/, '🪙'],
    [/\bblocks?\b|\bcubes?\b/, '🧊'], [/\bbuttons?\b/, '🔘'],
  ]
  for (const [re, e] of table) if (re.test(t)) return e
  return '🔵'
}

type Rule = (t: string, lower: string) => Visual | null

/**
 * Ordered most-specific first — the first rule that matches wins, so "half past three"
 * is read as a time before the word "half" can be mistaken for a fraction.
 */
const RULES: Rule[] = [
  // ── Time ────────────────────────────────────────────────────────
  (t, l) => {
    const oclock = l.match(new RegExp(`${N}\\s*o'?clock`))
    if (oclock) {
      const h = num(oclock[1])
      return h !== null ? { type: 'clock', hour: h, minute: 0, caption: `${h} o'clock` } : null
    }
    const half = l.match(new RegExp(`half past\\s*${N}`))
    if (half) {
      const h = num(half[1])
      return h !== null ? { type: 'clock', hour: h, minute: 30, caption: `Half past ${h}` } : null
    }
    const digital = t.match(/\b(\d{1,2}):(\d{2})\b/)
    if (digital) {
      return { type: 'clock', hour: parseInt(digital[1], 10), minute: parseInt(digital[2], 10),
               caption: `${digital[1]}:${digital[2]}` }
    }
    return null
  },

  // ── Place value: "4 tens and 2 ones", "3 tens" ──────────────────
  (_t, l) => {
    const both = l.match(new RegExp(`${N}\\s*tens?\\s*(?:and)?\\s*${N}\\s*ones?`))
    if (both) {
      const te = num(both[1]), on = num(both[2])
      if (te !== null && on !== null && te <= 9 && on <= 9) {
        return { type: 'baseTen', tens: te, ones: on, caption: `${te} tens and ${on} ones = ${te * 10 + on}` }
      }
    }
    const tensOnly = l.match(new RegExp(`${N}\\s*tens\\b`))
    if (tensOnly) {
      const te = num(tensOnly[1])
      if (te !== null && te <= 9) return { type: 'baseTen', tens: te, ones: 0, caption: `${te} tens = ${te * 10}` }
    }
    return null
  },

  // ── Multiplication: "3 groups of 4", "3 x 4", "5 boxes with 6 in each" ──
  (t, l) => {
    const m = l.match(new RegExp(`${N}\\s*(?:groups? of|sets? of|lots of|times|×|x|\\*)\\s*${N}`))
      // "5 boxes with 6 crayons in each box" is the same idea in story form.
      ?? l.match(new RegExp(`${N}\\s+\\w+\\s+(?:with|of|holding|containing)\\s+${N}\\b[^.]{0,30}?each`))
      ?? l.match(new RegExp(`${N}\\s+\\w+[^.]{0,20}?\\b${N}\\s+\\w+\\s+in each`))
    if (!m) return null
    const a = num(m[1]), b = num(m[2])
    if (a === null || b === null || a < 1 || b < 1) return null
    // Too big to draw as objects — show the number sentence assembling instead.
    if (a > 12 || b > 12) {
      return { type: 'equation', terms: [String(a), '×', String(b), '=', String(a * b)], caption: `${a} × ${b}` }
    }
    // Rows/arrays read better as a grid; everything else as separate groups.
    if (/row|array|column|grid/.test(l)) {
      return { type: 'array', rows: a, cols: b, caption: `${a} × ${b} = ${a * b}` }
    }
    return { type: 'groups', groups: a, itemsPerGroup: b, emoji: emojiFor(t),
             caption: `${a} groups of ${b} = ${a * b}` }
  },

  // ── "2 apples and your friend has 3, together you have 5" ───────
  (_t, l) => {
    if (!/together|altogether|in total|in all|combined/.test(l)) return null
    const ns = (l.match(/\d+/g) ?? []).map(Number).filter((n) => n <= 200)
    if (ns.length < 3) return null
    const w = Math.max(...ns)
    const parts = ns.filter((n) => n !== w)
    if (parts.length >= 2 && parts[0] + parts[1] === w) {
      return { type: 'numberBond', whole: w, partA: parts[0], partB: parts[1], caption: `${parts[0]} and ${parts[1]} make ${w}` }
    }
    return null
  },

  // ── Rounding: "13 is closer to 10 or 20", "round to the nearest 10" ──
  (_t, l) => {
    if (!/\bround(?:ing|ed|s)?\b|\bnearest\b|\bcloser to\b/.test(l)) return null
    const ns = (l.match(/\d+/g) ?? []).map(Number).filter((n) => n > 0 && n <= 1000)
    if (!ns.length) return null
    const target = ns[0]
    const step = ns.find((n) => n === 10 || n === 100 || n === 1000) ?? 10
    const lo = Math.floor(target / step) * step
    // A target that already sits on a boundary would otherwise repeat a stop.
    const jumps = [...new Set([lo, target, lo + step])].sort((a, b) => a - b)
    if (jumps.length < 2) return null
    return { type: 'numberLine', max: lo + step, jumps,
             caption: `${target} sits between ${lo} and ${lo + step}` }
  },

  // ── A multi-digit number being pulled apart by place value ──────
  (_t, l) => {
    if (!/place value|digit|hundreds|tens and ones|the number|expanded form/.test(l)) return null
    const m = l.match(/\b(\d{2,4})\b/)
    if (!m) return null
    const n = parseInt(m[1], 10)
    if (n < 10 || n > 9999) return null
    const h = Math.floor((n % 1000) / 100), te = Math.floor((n % 100) / 10), o = n % 10
    if (n >= 1000) {
      return { type: 'equation', terms: [String(n), '=', `${Math.floor(n / 1000)}×1000`, '+', `${h}×100`, '+', `${te}×10`, '+', String(o)],
               caption: `Place value of ${n}` }
    }
    return { type: 'baseTen', hundreds: h, tens: te, ones: o,
             caption: `${n} = ${h ? `${h} hundreds, ` : ''}${te} tens and ${o} ones` }
  },

  // ── Division / sharing ──────────────────────────────────────────
  (t, l) => {
    const m = l.match(new RegExp(`${N}\\s*(?:÷|/|divided by|shared? (?:between|among|by)|split (?:between|into))\\s*${N}`))
    if (!m) return null
    const a = num(m[1]), b = num(m[2])
    if (a === null || b === null || b < 1 || a < 1 || b > 12 || a / b > 20 || a % b !== 0) return null
    return { type: 'groups', groups: b, itemsPerGroup: a / b, emoji: emojiFor(t),
             caption: `${a} shared into ${b} groups = ${a / b} each` }
  },

  // ── Fractions ───────────────────────────────────────────────────
  (_t, l) => {
    const word = l.match(/\b(half|halves|third|thirds|quarter|quarters|fourth|fourths|fifth|fifths|eighth|eighths)\b/)
    const frac = l.match(/\b(\d+)\s*\/\s*(\d+)\b/)
    if (frac) {
      const s = parseInt(frac[1], 10), p = parseInt(frac[2], 10)
      if (p >= 2 && p <= 16 && s <= p) return { type: 'fractionBar', parts: p, shaded: s, caption: `${s}/${p}` }
    }
    /*
     * Plural forms (halves, thirds, quarters) are always fractions. Singular ones are
     * usually ordinals — "A third one:" and "the third step" must not draw a bar — so
     * they only count when followed by "of" or "a" ("a third of", "half a pizza").
     */
    const plural = l.match(/\b(halves|thirds|quarters|fourths|fifths|eighths)\b/)
    const singular = l.match(/\b(half|third|quarter|fourth|fifth|eighth)\s+(?:of|a)\b/)
    const hit = plural?.[1] ?? singular?.[1]
    if (word && hit) {
      const map: Record<string, number> = { half: 2, halves: 2, third: 3, thirds: 3, quarter: 4,
        quarters: 4, fourth: 4, fourths: 4, fifth: 5, fifths: 5, eighth: 8, eighths: 8 }
      const p = map[hit]
      if (p) return { type: 'fractionBar', parts: p, shaded: 1, caption: `1 out of ${p} parts` }
    }
    return null
  },

  // ── Fact families / number bonds: "5 and 3 make 8", "8 = 5 + 3" ─
  (_t, l) => {
    const make = l.match(new RegExp(`${N}\\s*(?:and|\\+)\\s*${N}\\s*(?:make[s]?|equals?|is|=|gives?)\\s*${N}`))
    if (make) {
      const a = num(make[1]), b = num(make[2]), w = num(make[3])
      if (a !== null && b !== null && w !== null && a + b === w && w <= 100) {
        return { type: 'numberBond', whole: w, partA: a, partB: b, caption: `${a} and ${b} make ${w}` }
      }
    }
    if (/fact family|number bond|part.?part.?whole/.test(l)) {
      const ns = (l.match(/\d+/g) ?? []).map(Number)
      const w = Math.max(...ns, 0)
      const parts = ns.filter((n) => n !== w)
      if (parts.length >= 2 && parts[0] + parts[1] === w) {
        return { type: 'numberBond', whole: w, partA: parts[0], partB: parts[1], caption: `Fact family for ${w}` }
      }
    }
    return null
  },

  // ── Comparing two numbers ───────────────────────────────────────
  (_t, l) => {
    if (!/greater|less than|bigger|smaller|more than|fewer|compare|larger|<|>/.test(l)) return null
    const m = l.match(new RegExp(`${N}[^\\d]{1,24}?${N}`))
    if (!m) return null
    const a = num(m[1]), b = num(m[2])
    if (a === null || b === null || a === b || a > 120 || b > 120) return null
    return { type: 'comparison', left: a, right: b, caption: `${a} ${a > b ? '>' : '<'} ${b}` }
  },

  // ── Skip counting ───────────────────────────────────────────────
  (_t, l) => {
    const m = l.match(new RegExp(`(?:count|skip|jump)[^.]{0,20}?by\\s*${N}`))
    if (!m) return null
    const step = num(m[1])
    if (step === null || step < 1 || step > 12) return null
    const max = step * 10
    return { type: 'numberLine', max, jumps: Array.from({ length: 11 }, (_, i) => i * step),
             caption: `Counting by ${step}s` }
  },

  // ── Tally charts ────────────────────────────────────────────────
  (_t, l) => {
    if (!/tally|tallies/.test(l)) return null
    const m = l.match(new RegExp(N))
    const c = num(m?.[1] ?? '')
    return c !== null && c >= 1 && c <= 30 ? { type: 'tally', count: c, caption: `${c} tallies` } : null
  },

  // ── Addition and subtraction ────────────────────────────────────
  (_t, l) => {
    const add = l.match(new RegExp(`${N}\\s*(?:\\+|plus|add)\\s*${N}`))
    if (add) {
      const a = num(add[1]), b = num(add[2])
      if (a !== null && b !== null && a + b <= 20 && a >= 0 && b >= 0) {
        // Within 20 a ten-frame shows *why* the answer is what it is.
        return { type: 'tenFrame', filled: a, ones: b, caption: `${a} + ${b} = ${a + b}` }
      }
      if (a !== null && b !== null) {
        return { type: 'equation', terms: [String(a), '+', String(b), '=', String(a + b)], caption: 'Step by step' }
      }
    }
    const sub = l.match(new RegExp(`${N}\\s*(?:-|−|minus|take away|subtract)\\s*${N}`))
    if (sub) {
      const a = num(sub[1]), b = num(sub[2])
      if (a !== null && b !== null && b <= a && a <= 20) {
        return { type: 'numberLine', max: a, jumps: [a, a - b], caption: `${a} − ${b} = ${a - b}` }
      }
      if (a !== null && b !== null && b <= a) {
        return { type: 'equation', terms: [String(a), '−', String(b), '=', String(a - b)], caption: 'Step by step' }
      }
    }
    return null
  },

  // ── Counting up to a number ─────────────────────────────────────
  (_t, l) => {
    const m = l.match(new RegExp(`count(?:ing)?\\s*(?:up\\s*)?to\\s*${N}`))
    if (!m) return null
    const max = num(m[1])
    if (max === null || max < 2 || max > 120) return null
    const step = max > 20 ? Math.round(max / 10) : 1
    return { type: 'numberLine', max, jumps: Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step),
             caption: `Counting to ${max}` }
  },

  // ── Language: a quoted example broken into word tiles ───────────
  // English lessons carry no numbers at all, so nothing above ever fires for them.
  // Quoted examples ("'The cat sleeps.'") are the concrete thing worth showing.
  (t) => {
    // A straight quote only opens at a word boundary and only closes before space or
    // punctuation — otherwise the apostrophes in "the one's place, ... the ten's place"
    // read as a quoted phrase.
    const q = t.match(/["“](.{4,60}?)["”]/)
      ?? t.match(/(?:^|[\s(])['‘](.{4,60}?)['’](?=[\s.,!?)]|$)/)
    if (!q) return null
    const phrase = q[1].trim()
    const words = phrase.replace(/[.!?]+$/, '').split(/\s+/)
    if (words.length < 2 || words.length > 10) return null
    return { type: 'wordCards', terms: words, caption: phrase }
  },

  // ── 2D/3D shapes ────────────────────────────────────────────────
  (_t, l) => {
    const m = l.match(/\b(circle|triangle|square|rectangle)s?\b/)
    return m ? { type: 'shape', shape: m[1], caption: `A ${m[1]}` } : null
  },
]

/** Best picture for a sentence, or null when there's nothing concrete to draw. */
export function inferVisual(text: string): Visual | null {
  const lower = text.toLowerCase()
  for (const rule of RULES) {
    try {
      const v = rule(text, lower)
      if (v) return v
    } catch { /* a malformed sentence should never break the lesson */ }
  }
  return null
}
