import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Printer, RotateCcw, Sparkles } from 'lucide-react'

const NUMBERS = Array.from({ length: 100 }, (_, i) => i + 1)
const SKIPS = [2, 3, 4, 5, 10]

export default function HundredsChart() {
  const [skip, setSkip] = useState<number | null>(null)     // spotlight a skip-counting pattern
  const [parity, setParity] = useState<'even' | 'odd' | null>(null)
  const [active, setActive] = useState<number | null>(null) // tapped number
  const [hide, setHide] = useState(false)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())

  const reset = () => { setSkip(null); setParity(null); setActive(null); setRevealed(new Set()) }
  const shown = (n: number) => !hide || revealed.has(n)

  const tap = (n: number) => {
    setActive(n)
    if (hide) setRevealed((prev) => new Set(prev).add(n))
  }

  const isMarked = (n: number) =>
    (skip != null && n % skip === 0) ||
    (parity === 'even' && n % 2 === 0) ||
    (parity === 'odd' && n % 2 === 1)

  // The teaching banner adapts to what the child is doing.
  let banner = 'Tap a number to see its place value and neighbours'
  if (active != null) {
    banner = `${active} = ${Math.floor(active / 10)} tens + ${active % 10} ones` +
      `${active + 10 <= 100 ? ` · +10 = ${active + 10}` : ''}${active - 10 >= 1 ? ` · −10 = ${active - 10}` : ''}`
  } else if (skip != null) {
    banner = `Counting by ${skip}s: ${NUMBERS.filter((n) => n % skip === 0).slice(0, 6).join(', ')} …`
  } else if (parity) {
    banner = parity === 'even' ? 'Even numbers end in 0, 2, 4, 6, or 8' : 'Odd numbers end in 1, 3, 5, 7, or 9'
  }

  return (
    <div className="app-shell student-theme">
      <header className="topbar">
        <div className="brand">🦉 Aria</div>
        <Link className="btn btn--ghost" to="/student/resources"><ArrowLeft size={16} /> Resources</Link>
      </header>

      <main className="container">
        <div className="greeting card card--hero">
          <h1>💯 Hundreds Chart</h1>
          <p>Count, skip-count, and spot number patterns from 1 to 100.</p>
        </div>

        <div className="card">
          <div className="mult-fact" aria-live="polite">{banner}</div>

          <div className="mult-controls no-print">
            <div className="mult-control-group">
              <span className="mult-control-label">Skip count by</span>
              {SKIPS.map((s) => (
                <button key={s} className={`chip chip--sq ${skip === s ? 'chip--on' : ''}`}
                        onClick={() => { setSkip(skip === s ? null : s); setParity(null); setActive(null) }}>{s}</button>
              ))}
            </div>
            <div className="mult-control-group">
              <span className="mult-control-label">Show</span>
              <button className={`chip ${parity === 'even' ? 'chip--on' : ''}`}
                      onClick={() => { setParity(parity === 'even' ? null : 'even'); setSkip(null); setActive(null) }}>Even</button>
              <button className={`chip ${parity === 'odd' ? 'chip--on' : ''}`}
                      onClick={() => { setParity(parity === 'odd' ? null : 'odd'); setSkip(null); setActive(null) }}>Odd</button>
            </div>
            <button className={`chip ${hide ? 'chip--on' : ''}`} onClick={() => { setHide(!hide); setRevealed(new Set()) }}>
              {hide ? <><EyeOff size={14} /> Numbers hidden</> : <><Eye size={14} /> Hide numbers</>}
            </button>
            <button className="chip" onClick={reset}><RotateCcw size={14} /> Reset</button>
            <button className="chip" onClick={() => window.print()}><Printer size={14} /> Print</button>
          </div>
        </div>

        <div className="mult-scroll">
          <table className="mult-table">
            <tbody>
              {Array.from({ length: 10 }, (_, row) => (
                <tr key={row}>
                  {NUMBERS.slice(row * 10, row * 10 + 10).map((n) => {
                    const marked = isMarked(n)
                    const isActive = active === n
                    const neighbour = active != null && [active - 1, active + 1, active - 10, active + 10].includes(n)
                    return (
                      <td key={n}
                          className={[
                            'mult-cell',
                            marked ? 'mult-cell--mark' : '',
                            isActive ? 'mult-cell--active' : '',
                            neighbour ? 'mult-cell--cross' : '',
                          ].join(' ')}
                          onClick={() => tap(n)}>
                        {shown(n) ? n : '·'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="hint no-print">
          <Sparkles size={14} /> Tip: skip-count by 5s or 10s and watch the columns light up!
        </p>
      </main>
    </div>
  )
}
