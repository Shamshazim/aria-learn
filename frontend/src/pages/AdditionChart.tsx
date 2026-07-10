import { useState } from 'react'
import { Link } from 'react-router-dom'
import KidHeader from '../components/KidHeader'
import { ArrowLeft, Eye, EyeOff, Printer, RotateCcw, Sparkles } from 'lucide-react'
import { celebrateCorrect, celebrateBig } from '../lib/celebrate'

type Cell = { r: number; c: number }
type Mode = 'explore' | 'quiz'
const MAX = 10
const CELLS = Array.from({ length: MAX + 1 }, (_, i) => i) // 0..10

function tint(sum: number): { background: string; color: string } {
  const t = sum / (MAX * 2)
  return { background: `rgba(20, 184, 166, ${(0.06 + t * 0.5).toFixed(3)})`, color: t > 0.55 ? '#fff' : 'var(--ink)' }
}

/** A + or − fact question with three plausible distractors. Always terminates. */
function makeQuestion(op: '+' | '-') {
  const a = Math.floor(Math.random() * (MAX + 1))
  const b = Math.floor(Math.random() * (MAX + 1))
  const sum = a + b
  const q = op === '+' ? { text: `${a} + ${b}`, answer: sum } : { text: `${sum} − ${a}`, answer: b }
  const wrong = new Set<number>()
  const nudges = [1, -1, 2, -2, a || 1].sort(() => Math.random() - 0.5)
  for (const d of nudges) { if (wrong.size >= 3) break; const c = q.answer + d; if (c >= 0 && c !== q.answer) wrong.add(c) }
  for (let k = 1; wrong.size < 3; k++) wrong.add(q.answer + k)
  return { ...q, options: [q.answer, ...wrong].sort(() => Math.random() - 0.5) }
}

export default function AdditionChart() {
  const [mode, setMode] = useState<Mode>('explore')
  const [active, setActive] = useState<Cell | null>(null)
  const [hide, setHide] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const keyOf = (r: number, c: number) => `${r}+${c}`
  const isShown = (r: number, c: number) => !hide || revealed.has(keyOf(r, c))
  const reset = () => { setActive(null); setRevealed(new Set()) }
  const tap = (r: number, c: number) => { setActive({ r, c }); if (hide) setRevealed((p) => new Set(p).add(keyOf(r, c))) }

  const banner = active
    ? `${active.r} + ${active.c} = ${isShown(active.r, active.c) ? active.r + active.c : '?'}`
    : 'Tap a square to see its addition fact'

  return (
    <div className="app-shell student-theme">
      <KidHeader right={<Link className="btn btn--ghost" to="/student/resources"><ArrowLeft size={16} /> Resources</Link>} />

      <main className="container">
        <div className="greeting card card--hero">
          <h1>➕ Addition &amp; Subtraction Facts</h1>
          <p>Learn your number bonds — explore the facts, hide them to test yourself, or quiz on + and −.</p>
        </div>

        <div className="mode-tabs no-print">
          <button className={`subject-tab ${mode === 'explore' ? 'subject-tab--active' : ''}`} onClick={() => setMode('explore')}>🔎 Explore</button>
          <button className={`subject-tab ${mode === 'quiz' ? 'subject-tab--active' : ''}`} onClick={() => setMode('quiz')}>⚡ Quiz me</button>
        </div>

        {mode === 'explore' ? (
          <>
            <div className="card">
              <div className="mult-fact" aria-live="polite">{banner}</div>
              <div className="mult-controls no-print">
                <button className={`chip ${hide ? 'chip--on' : ''}`} onClick={() => { setHide(!hide); setRevealed(new Set()) }}>
                  {hide ? <><EyeOff size={14} /> Answers hidden</> : <><Eye size={14} /> Hide answers</>}
                </button>
                <button className="chip" onClick={reset}><RotateCcw size={14} /> Reset</button>
                <button className="chip" onClick={() => window.print()}><Printer size={14} /> Print</button>
              </div>
            </div>

            <div className="mult-scroll">
              <table className="mult-table">
                <thead>
                  <tr>
                    <th className="mult-corner">+</th>
                    {CELLS.map((c) => (
                      <th key={c} className={`mult-head ${active?.c === c ? 'mult-head--active' : ''}`}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CELLS.map((r) => (
                    <tr key={r}>
                      <th className={`mult-head ${active?.r === r ? 'mult-head--active' : ''}`}>{r}</th>
                      {CELLS.map((c) => {
                        const show = isShown(r, c)
                        const isActive = active?.r === r && active?.c === c
                        const inCross = active != null && (active.r === r || active.c === c)
                        const style = show ? tint(r + c) : { background: '', color: '' }
                        return (
                          <td key={c}
                              className={['mult-cell', isActive ? 'mult-cell--active' : '', inCross ? 'mult-cell--cross' : ''].join(' ')}
                              style={style} onClick={() => tap(r, c)}>
                            {show ? r + c : '·'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="hint no-print"><Sparkles size={14} /> Tip: the diagonal shows the doubles — 1+1, 2+2, 3+3 …</p>
          </>
        ) : (
          <QuizPanel />
        )}
      </main>
    </div>
  )
}

function QuizPanel() {
  const [op, setOp] = useState<'+' | '-'>('+')
  const [q, setQ] = useState(() => makeQuestion('+'))
  const [picked, setPicked] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(0)

  const next = (o: '+' | '-' = op) => { setQ(makeQuestion(o)); setPicked(null) }
  const swap = (o: '+' | '-') => { setOp(o); next(o) }

  const choose = (opt: number) => {
    if (picked != null) return
    setPicked(opt)
    if (opt === q.answer) {
      const s = streak + 1; setStreak(s); setBest((b) => Math.max(b, s))
      if (s % 5 === 0) celebrateBig(); else celebrateCorrect()
      setTimeout(() => next(), 900)
    } else setStreak(0)
  }

  return (
    <div className="card quiz-card">
      <div className="quiz-scoreline">
        <span className="quiz-streak">🔥 Streak: <strong>{streak}</strong></span>
        <span className="muted">Best: {best}</span>
      </div>

      <div className="mode-tabs no-print" style={{ justifyContent: 'center' }}>
        <button className={`subject-tab ${op === '+' ? 'subject-tab--active' : ''}`} onClick={() => swap('+')}>➕ Adding</button>
        <button className={`subject-tab ${op === '-' ? 'subject-tab--active' : ''}`} onClick={() => swap('-')}>➖ Subtracting</button>
      </div>

      <div className="quiz-question">{q.text} = ?</div>
      <div className="quiz-options">
        {q.options.map((opt) => {
          const state = picked == null ? '' : opt === q.answer ? 'quiz-opt--right' : picked === opt ? 'quiz-opt--wrong' : 'quiz-opt--fade'
          return (
            <button key={opt} className={`quiz-opt ${state}`} onClick={() => choose(opt)} disabled={picked != null}>{opt}</button>
          )
        })}
      </div>

      {picked != null && picked !== q.answer && (
        <div className="quiz-feedback">
          Not quite — {q.text} = <strong>{q.answer}</strong>.
          <button className="btn btn--primary btn--sm" onClick={() => next()}>Try another →</button>
        </div>
      )}
      {picked === q.answer && <div className="quiz-feedback quiz-feedback--right">Correct! 🎉</div>}
    </div>
  )
}
