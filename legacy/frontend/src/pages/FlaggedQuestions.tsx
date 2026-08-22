import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flag } from 'lucide-react'
import { api, FlagItem } from '../api'
import { useAuth } from '../auth'

export default function FlaggedQuestions() {
  const { logout } = useAuth()
  const [flags, setFlags] = useState<FlagItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => api.parentFlags().then(setFlags).catch((e) => setError((e as Error).message))
  useEffect(() => { load() }, [])

  const dismiss = async (flagId: string) => {
    setBusy(flagId)
    try { await api.resolveFlag(flagId); setFlags((f) => f.filter((x) => x.flagId !== flagId)) }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(null) }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">🦉 Aria <span className="muted">· Parent</span></div>
        <div className="topbar-right">
          <Link className="btn btn--ghost" to="/parent">← Dashboard</Link>
          <button className="btn btn--ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="container narrow">
        <h2><Flag size={20} /> Reported questions</h2>
        <p className="muted">Questions your children flagged as wrong or confusing. Review the answer key and dismiss when handled.</p>
        {error && <div className="error">{error}</div>}
        {flags.length === 0 && <div className="card"><p className="muted">Nothing reported. 🎉</p></div>}

        {flags.map((f) => (
          <section key={f.flagId} className="card">
            <div className="topic-status-row">
              <span className="chip chip--good">{f.childName}</span>
              <span className="muted">{new Date(f.createdAt).toLocaleDateString()}</span>
            </div>
            <h3 className="q-prompt">{f.prompt}</h3>
            {f.choices.length > 0 && (
              <ul className="flag-choices">
                {f.choices.map((c) => (
                  <li key={c} className={f.correctAnswer && c === f.correctAnswer ? 'flag-choice--correct' : ''}>
                    {c}{f.correctAnswer && c === f.correctAnswer ? '  ✓ (stored answer)' : ''}
                  </li>
                ))}
              </ul>
            )}
            {f.correctAnswer && f.choices.length === 0 && (
              <div>Stored answer: <strong>{f.correctAnswer}</strong></div>
            )}
            {f.solution && <p className="solution">{f.solution}</p>}
            {f.reason && <p className="muted">Note from child: “{f.reason}”</p>}
            <button className="btn btn--primary" disabled={busy === f.flagId} onClick={() => dismiss(f.flagId)}>
              {busy === f.flagId ? 'Dismissing…' : 'Dismiss'}
            </button>
          </section>
        ))}
      </main>
    </div>
  )
}
