/**
 * The three age bands the student experience is designed for.
 *
 * The band changes density, wording, animation, and the answer control — never the
 * teaching engine. A grade 8 student meeting the TK layout stops trusting the app, and a
 * TK child meeting the grade 8 layout cannot read it, so this one value drives all of it.
 */
export type Band = 'early' | 'middle' | 'senior'

/**
 * Reads a band out of a curriculum grade name such as "Grade 3", "TK" or "Kindergarten".
 *
 * An unknown name falls back to `middle`: it is the band that neither patronises an older
 * child nor overwhelms a younger one, so it is the safest thing to show while a profile
 * is still loading or a grade is missing.
 */
export function bandForGrade(gradeName: string | null | undefined): Band {
  const raw = (gradeName ?? '').toLowerCase()
  if (/\btk\b|transitional/.test(raw)) return 'early'
  if (/kinder/.test(raw)) return 'early'
  const m = raw.match(/(\d+)/)
  if (!m) return 'middle'
  const n = Number(m[1])
  if (n <= 2) return 'early'
  if (n <= 5) return 'middle'
  return 'senior'
}

/** Lets us preview a band from the URL (?band=early) without editing a child's grade. */
export function bandOverride(search: string): Band | null {
  const v = new URLSearchParams(search).get('band')
  return v === 'early' || v === 'middle' || v === 'senior' ? v : null
}
