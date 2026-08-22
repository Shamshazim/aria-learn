import { Link } from 'react-router-dom'
import { ArrowLeft, Flame, LayoutDashboard } from 'lucide-react'
import AriaOwl from './AriaOwl'
import { SessionState } from '../types'

/**
 * The only chrome on the screen.
 *
 * It carries what a child is glad to see — their name, their class, their streak, how far
 * they have come — and one thing they can act on: the way back to the class list. There
 * is still no topic list, because the moment a child can pick a topic they stop doing the
 * one Aria chose for them. Choosing the class is theirs; choosing the lesson is not.
 *
 * The dashboard link is deliberately small and last. It exists so a parent sitting beside
 * the child can reach the old view; it is not part of the child's path.
 */
export default function SessionTopbar({ state }: { state: SessionState }) {
  const band = state.band

  return (
    <header className="sx-topbar">
      <div className="sx-brand"><AriaOwl size={34} avatar /> Aria Learn</div>

      <div className="sx-topbar-mid">
        {band === 'senior'
          ? (
            <div className="sx-focus">
              {state.subject && <strong>{state.subject}</strong>}
              {state.subject && ' · '}
              Today&apos;s focus: {state.focus}
            </div>
          )
          : (
            <div className="sx-who">
              <span className="sx-avatar">🙂</span> {state.childName}
              {state.subject && <span className="sx-focus">· {state.subject}</span>}
            </div>
          )}
      </div>

      <div className="sx-topbar-right">
        {state.streak > 0 && <span className="sx-flame"><Flame size={20} color="#F4712B" /> {state.streak}</span>}
        {band !== 'early' && <span className="sx-chip">Level {state.level}</span>}
        {band !== 'early' && (
          <span className="sx-xp"><i style={{ width: `${Math.round(state.xpProgress * 100)}%` }} /></span>
        )}
        {band === 'senior' && <div className="sx-who"><span className="sx-avatar">🙂</span> {state.childName}</div>}
        <span className="sx-rule" />
        {/* Worded, not an arrow alone: the early band cannot be relied on to read an
            icon as "go back", and this is the one control on the screen they may need. */}
        <Link className="sx-linkbtn sx-linkbtn--back" to="/student">
          <ArrowLeft size={18} /> Classes
        </Link>
        <Link className="sx-linkbtn" to="/student/dashboard" aria-label="Open the full dashboard">
          <LayoutDashboard size={18} />
        </Link>
      </div>
    </header>
  )
}
