// Detects a simple multiplication or division problem in a question prompt so the
// interactive shape manipulative can be offered. Deliberately conservative: only
// whole-number × and ÷ within kid-friendly sizes, so we never show an unusable
// (too many shapes) or misread (e.g. a decimal/fraction) manipulative.

export interface MathProblem {
  op: '×' | '÷'
  /** For ÷: the total to share. For ×: the number of groups. */
  a: number
  /** For ÷: the number of groups. For ×: how many per group. */
  b: number
}

// ÷: share `a` into `b` equal groups. Need a ≥ b so grouping is meaningful
// (this also rejects proper fractions like "3/4"). Caps keep shapes manageable.
function okDivision(a: number, b: number): boolean {
  return b >= 2 && b <= 8 && a >= b && a <= 24
}
// ×: `a` groups of `b`. Keep the total (shapes shown) small.
function okMultiplication(a: number, b: number): boolean {
  return a >= 1 && a <= 8 && b >= 1 && b <= 8 && a * b >= 2 && a * b <= 36
}

export function parseMathProblem(prompt: string | null | undefined): MathProblem | null {
  if (!prompt) return null
  const s = prompt.toLowerCase()

  // ── Division ──
  // "10 ÷ 2", "10 / 2", "10 divided by 2" (lookarounds avoid decimals like 10.5)
  const divOp = s.match(/(?<![\d.])(\d{1,2})\s*(?:÷|\/|divided by)\s*(\d{1,2})(?![\d.])/)
  if (divOp) {
    const a = +divOp[1], b = +divOp[2]
    if (okDivision(a, b)) return { op: '÷', a, b }
  }
  // "share/split/divide/separate 10 into 2 (equal) groups"
  const intoGroups = s.match(/(?:shar|split|divid|separat|put)\w*\s+(\d{1,2})\s+.*?\binto\s+(\d{1,2})\s+(?:equal\s+)?(?:group|part|pile|team|box|plate)/)
  if (intoGroups) {
    const a = +intoGroups[1], b = +intoGroups[2]
    if (okDivision(a, b)) return { op: '÷', a, b }
  }

  // ── Multiplication ──
  // "3 × 4", "3 x 4", "3 * 4", "3 times 4", "3 multiplied by 4"
  const mulOp = s.match(/(?<![\d.])(\d{1,2})\s*(?:×|x|\*|times|multiplied by)\s*(\d{1,2})(?![\d.])/)
  if (mulOp) {
    const a = +mulOp[1], b = +mulOp[2]
    if (okMultiplication(a, b)) return { op: '×', a, b }
  }
  // "3 groups of 4"
  const groupsOf = s.match(/(\d{1,2})\s+(?:group|pile|team|box|plate|row|bag|basket)s?\s+of\s+(\d{1,2})/)
  if (groupsOf) {
    const a = +groupsOf[1], b = +groupsOf[2]
    if (okMultiplication(a, b)) return { op: '×', a, b }
  }
  return null
}
