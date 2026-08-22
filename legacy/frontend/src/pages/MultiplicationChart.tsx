import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import KidHeader from '../components/KidHeader'
import { ArrowLeft, Eye, EyeOff, Printer, RotateCcw, Sparkles } from 'lucide-react'
import { celebrateCorrect, celebrateBig } from '../lib/celebrate'

type Cell = { r: number; c: number }
type Mode = 'explore' | 'quiz'

/** Background tint for a product cell — a gentle indigo heatmap so bigger answers feel "hotter". */
function cellTint(product: number, max: number): { background: string; color: string } {
  const t = product / max // 0..1
  const alpha = 0.06 + t * 0.5
  return { background: `rgba(99, 102, 241, ${alpha.toFixed(3)})`, color: t > 0.55 ? '#fff' : 'var(--ink)' }
}

/** Build a multiple-choice quiz question for a × b with three plausible distractors. */
function makeQuestion(size: number, focus: number | null) {
  const a = focus ?? 1 + Math.floor(Math.random() * size)
  const b = 1 + Math.floor(Math.random() * size)
  const answer = a * b
  const wrong = new Set<number>()
  // Plausible near-misses first (off by one factor, adjacent products), shuffled for variety.
  const nudges = [a, -a, b, -b, a + b, 1, -1, 2].sort(() => Math.random() - 0.5)
  for (const delta of nudges) {
    if (wrong.size >= 3) break
    const cand = answer + delta
    if (cand > 0 && cand !== answer) wrong.add(cand)
  }
  // Guarantee three distractors even for tiny answers (e.g. 1×1) — always terminates.
  for (let k = 1; wrong.size < 3; k++) wrong.add(answer + k)
  const options = [answer, ...wrong].sort(() => Math.random() - 0.5)
  return { a, b, answer, options }
}

export default function MultiplicationChart() {
  const [size, setSize] = useState(12)
  const [mode, setMode] = useState<Mode>('explore')

  // Explore-mode state.
  const [active, setActive] = useState<Cell | null>(null)
  const [focus, setFocus] = useState<number | null>(null) // spotlight one times-table
  const [hide, setHide] = useState(false)                 // hide answers to self-test
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const rows = useMemo(() => Array.from({ length: size }, (_, i) => i + 1), [size])
  const maxProduct = size * size

  const keyOf = (r: number, c: number) => `${r}x${c}`
  const isRevealed = (r: number, c: number) => !hide || revealed.has(keyOf(r, c))

  const reset = () => { setActive(null); setFocus(null); setRevealed(new Set()) }

  const tapCell = (r: number, c: number) => {
    setActive({ r, c })
    if (hide) setRevealed((prev) => new Set(prev).add(keyOf(r, c)))
  }

  // The fact shown in the banner (the "?" keeps it a self-test in hide mode).
  const bannerFact = active
    ? `${active.r} × ${active.c} = ${isRevealed(active.r, active.c) ? active.r * active.c : '?'}`
    : 'Tap a square to see its multiplication fact'

  return (
    <div className="app-shell student-theme">
      <KidHeader right={<Link className="btn btn--ghost" to="/student/resources"><ArrowLeft size={16} /> Resources</Link>} />

      <main className="container">
        <div className="greeting card card--hero">
          <h1>✖️ Multiplication Chart</h1>
          <p>Explore the times tables, hide the answers to test yourself, or play a quick quiz!</p>
        </div>

        <div className="mode-tabs no-print">
          <button className={`subject-tab ${mode === 'explore' ? 'subject-tab--active' : ''}`} onClick={() => setMode('explore')}>🔎 Explore</button>
          <button className={`subject-tab ${mode === 'quiz' ? 'subject-tab--active' : ''}`} onClick={() => setMode('quiz')}>⚡ Quiz me</button>
        </div>

        {mode === 'explore' ? (
          <>
            <div className="card">
              <div className="mult-fact" aria-live="polite">{bannerFact}</div>

              <div className="mult-controls no-print">
                <div className="mult-control-group">
                  <span className="mult-control-label">Size</span>
                  {[10, 12].map((s) => (
                    <button key={s} className={`chip ${size === s ? 'chip--on' : ''}`}
                            onClick={() => { setSize(s); reset() }}>{s}×{s}</button>
                  ))}
                </div>
                <button className={`chip ${hide ? 'chip--on' : ''}`} onClick={() => { setHide(!hide); setRevealed(new Set()) }}>
                  {hide ? <><EyeOff size={14} /> Answers hidden</> : <><Eye size={14} /> Hide answers</>}
                </button>
                <button className="chip" onClick={reset}><RotateCcw size={14} /> Reset</button>
                <button className="chip" onClick={() => window.print()}><Printer size={14} /> Print</button>
              </div>

              <div className="mult-control-group no-print" style={{ marginTop: '0.6rem' }}>
                <span className="mult-control-label">Spotlight a table</span>
                {rows.map((n) => (
                  <button key={n} className={`chip chip--sq ${focus === n ? 'chip--on' : ''}`}
                          onClick={() => setFocus(focus === n ? null : n)}>{n}</button>
                ))}
              </div>
            </div>

            <div className="mult-scroll">
              <table className="mult-table">
                <thead>
                  <tr>
                    <th className="mult-corner">×</th>
                    {rows.map((c) => (
                      <th key={c} className={`mult-head ${active?.c === c ? 'mult-head--active' : ''} ${focus === c ? 'mult-head--focus' : ''}`}
                          onClick={() => setFocus(focus === c ? null : c)}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r}>
                      <th className={`mult-head ${active?.r === r ? 'mult-head--active' : ''} ${focus === r ? 'mult-head--focus' : ''}`}
                          onClick={() => setFocus(focus === r ? null : r)}>{r}</th>
                      {rows.map((c) => {
                        const product = r * c
                        const inFocus = focus == null || focus === r || focus === c
                        const isActive = active?.r === r && active?.c === c
                        const inCross = active != null && (active.r === r || active.c === c)
                        const show = isRevealed(r, c)
                        const tint = show ? cellTint(product, maxProduct) : { background: '', color: '' }
                        return (
                          <td key={c}
                              className={[
                                'mult-cell',
                                r === c ? 'mult-cell--diag' : '',
                                isActive ? 'mult-cell--active' : '',
                                inCross ? 'mult-cell--cross' : '',
                                inFocus ? '' : 'mult-cell--dim',
                              ].join(' ')}
                              style={{ background: tint.background, color: tint.color }}
                              onClick={() => tapCell(r, c)}>
                            {show ? product : '·'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="hint no-print">
              <Sparkles size={14} /> Tip: tap a number on the edge to spotlight that whole times-table.
            </p>
          </>
        ) : (
          <QuizPanel size={size} />
        )}
      </main>
    </div>
  )
}

function QuizPanel({ size }: { size: number }) {
  const [focus, setFocus] = useState<number | null>(null)
  const [q, setQ] = useState(() => makeQuestion(size, null))
  const [picked, setPicked] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(0)

  const next = (f: number | null = focus) => { setQ(makeQuestion(size, f)); setPicked(null) }

  const choose = (opt: number) => {
    if (picked != null) return
    setPicked(opt)
    if (opt === q.answer) {
      const s = streak + 1
      setStreak(s)
      setBest((b) => Math.max(b, s))
      if (s > 0 && s % 5 === 0) celebrateBig(); else celebrateCorrect()
      setTimeout(() => next(), 900)
    } else {
      setStreak(0)
    }
  }

  const rows = Array.from({ length: size }, (_, i) => i + 1)

  return (
    <div className="card quiz-card">
      <div className="quiz-scoreline">
        <span className="quiz-streak">🔥 Streak: <strong>{streak}</strong></span>
        <span className="muted">Best: {best}</span>
      </div>

      <div className="mult-control-group no-print" style={{ justifyContent: 'center', marginBottom: '0.4rem' }}>
        <span className="mult-control-label">Focus</span>
        <button className={`chip ${focus == null ? 'chip--on' : ''}`} onClick={() => { setFocus(null); next(null) }}>Mixed</button>
        {rows.map((n) => (
          <button key={n} className={`chip chip--sq ${focus === n ? 'chip--on' : ''}`}
                  onClick={() => { setFocus(n); next(n) }}>{n}</button>
        ))}
      </div>

      <div className="quiz-question">{q.a} × {q.b} = ?</div>

      <div className="quiz-options">
        {q.options.map((opt) => {
          const isPicked = picked === opt
          const isAnswer = opt === q.answer
          const state = picked == null ? '' : isAnswer ? 'quiz-opt--right' : isPicked ? 'quiz-opt--wrong' : 'quiz-opt--fade'
          return (
            <button key={opt} className={`quiz-opt ${state}`} onClick={() => choose(opt)} disabled={picked != null}>
              {opt}
            </button>
          )
        })}
      </div>

      {picked != null && picked !== q.answer && (
        <div className="quiz-feedback">
          Not quite — {q.a} × {q.b} = <strong>{q.answer}</strong>.
          <button className="btn btn--primary btn--sm" onClick={() => next()}>Try another →</button>
        </div>
      )}
      {picked === q.answer && <div className="quiz-feedback quiz-feedback--right">Correct! 🎉</div>}
    </div>
  )
}
