import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, LayoutGrid, RotateCcw, Shuffle, SquareStack } from 'lucide-react'
import ReadAloud from '../components/ReadAloud'
import { FRY_FIRST_100 } from '../lib/sightWords'
import { celebrateCorrect, celebrateBig } from '../lib/celebrate'

type View = 'card' | 'list'

export default function SightWords() {
  const [setIdx, setSetIdx] = useState(0)
  const [view, setView] = useState<View>('card')
  const [pos, setPos] = useState(0)
  const [order, setOrder] = useState<number[]>(() => FRY_FIRST_100[0].words.map((_, i) => i))
  const [known, setKnown] = useState<Set<string>>(new Set())

  const current = FRY_FIRST_100[setIdx]
  const word = current.words[order[pos]]
  const knownInSet = current.words.filter((w) => known.has(w)).length

  const pickSet = (i: number) => {
    setSetIdx(i)
    setOrder(FRY_FIRST_100[i].words.map((_, j) => j))
    setPos(0)
  }

  const shuffle = () => {
    setOrder((prev) => [...prev].sort(() => Math.random() - 0.5))
    setPos(0)
  }

  const advance = () => setPos((p) => (p + 1) % order.length)

  const markKnown = () => {
    const nextKnown = new Set(known).add(word)
    setKnown(nextKnown)
    // Celebrate finishing a whole set; otherwise a small cheer.
    if (current.words.every((w) => nextKnown.has(w))) celebrateBig()
    else celebrateCorrect()
    advance()
  }

  const resetSet = () => setKnown((prev) => {
    const n = new Set(prev)
    current.words.forEach((w) => n.delete(w))
    return n
  })

  return (
    <div className="app-shell student-theme">
      <header className="topbar">
        <div className="brand">🦉 Aria</div>
        <Link className="btn btn--ghost" to="/student/resources"><ArrowLeft size={16} /> Resources</Link>
      </header>

      <main className="container">
        <div className="greeting card card--hero">
          <h1>👀 Sight Words</h1>
          <p>These are the most common words in English — learn to read them in a snap!</p>
        </div>

        <div className="card">
          <div className="mult-control-group no-print">
            <span className="mult-control-label">Set</span>
            {FRY_FIRST_100.map((s, i) => (
              <button key={s.label} className={`chip ${setIdx === i ? 'chip--on' : ''}`} onClick={() => pickSet(i)}>{s.label}</button>
            ))}
          </div>
          <div className="mult-control-group no-print" style={{ marginTop: '0.6rem' }}>
            <span className="mult-control-label">View</span>
            <button className={`chip ${view === 'card' ? 'chip--on' : ''}`} onClick={() => setView('card')}><SquareStack size={14} /> Flashcards</button>
            <button className={`chip ${view === 'list' ? 'chip--on' : ''}`} onClick={() => setView('list')}><LayoutGrid size={14} /> All words</button>
            <button className="chip" onClick={shuffle}><Shuffle size={14} /> Shuffle</button>
            <button className="chip" onClick={resetSet}><RotateCcw size={14} /> Reset set</button>
          </div>
          <div className="sw-progress">
            <div className="sw-progress-bar" style={{ width: `${(knownInSet / current.words.length) * 100}%` }} />
          </div>
          <p className="muted sw-progress-label">{knownInSet} / {current.words.length} words known in this set</p>
        </div>

        {view === 'card' ? (
          <div className="card sw-flashcard">
            <div className={`sw-word ${known.has(word) ? 'sw-word--known' : ''}`}>{word}</div>
            <div className="sw-card-actions">
              <ReadAloud text={word} label="Hear it" />
            </div>
            <div className="sw-card-nav">
              <button className="btn btn--ghost" onClick={advance}>Skip →</button>
              <button className="btn btn--accent" onClick={markKnown}><Check size={16} /> I know it!</button>
            </div>
            <p className="muted">Card {pos + 1} of {order.length}</p>
          </div>
        ) : (
          <div className="sw-grid">
            {current.words.map((w) => (
              <div key={w} className={`sw-chip ${known.has(w) ? 'sw-chip--known' : ''}`}>
                {known.has(w) && <Check size={13} />} {w}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
