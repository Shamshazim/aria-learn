import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, MasteryConfig, NotificationPreference } from '../api'
import { useAuth } from '../auth'
import ChangePassword from '../components/ChangePassword'

function NotificationPrefs() {
  const [prefs, setPrefs] = useState<NotificationPreference[]>([])
  useEffect(() => { api.notificationPreferences().then(setPrefs).catch(() => {}) }, [])
  const toggle = async (type: string, enabled: boolean) => {
    setPrefs((list) => list.map((p) => (p.type === type ? { ...p, enabled } : p)))
    try { await api.updateNotificationPreference(type, enabled) } catch { /* ignore */ }
  }
  return (
    <section className="card">
      <h3>Notifications</h3>
      <p className="muted">Choose which alerts you want to receive.</p>
      {prefs.map((p) => (
        <label key={p.type} className="toggle-row">
          <span>{p.label}</span>
          <button type="button" className={`toggle ${p.enabled ? 'toggle--on' : ''}`}
                  onClick={() => toggle(p.type, !p.enabled)} aria-pressed={p.enabled}>
            <span className="toggle-knob" />
          </button>
        </label>
      ))}
    </section>
  )
}

export default function MasteryConfigPage() {
  const { logout } = useAuth()
  const [cfg, setCfg] = useState<MasteryConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.getMasteryConfig().then(setCfg).catch((e) => setError((e as Error).message))
  }, [])

  if (!cfg) {
    return <div className="app-shell"><main className="container">{error ?? 'Loading...'}</main></div>
  }

  const weightSum = cfg.weightKnowledge + cfg.weightPractice + cfg.weightQuiz + cfg.weightHomework
  const set = (k: keyof MasteryConfig, v: number) => { setCfg({ ...cfg, [k]: v }); setSaved(false) }

  const save = async () => {
    setError(null); setBusy(true)
    try {
      setCfg(await api.updateMasteryConfig(cfg))
      setSaved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const weightRow = (label: string, key: keyof MasteryConfig) => (
    <label className="weight-row">
      <span>{label}</span>
      <input type="number" min={0} max={100} value={cfg[key] as number}
             onChange={(e) => set(key, Number(e.target.value))} />
    </label>
  )

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
        <h2>Mastery settings</h2>
        <p className="muted">Control how a topic's mastery score is calculated and how high the bar is to unlock the next topic.</p>

        <section className="card">
          <h3>Score weights</h3>
          <p className="muted">These must add up to 100.</p>
          {weightRow('📘 Knowledge', 'weightKnowledge')}
          {weightRow('✏️ Practice', 'weightPractice')}
          {weightRow('📝 Quiz', 'weightQuiz')}
          {weightRow('🏠 Homework', 'weightHomework')}
          <div className={`weight-sum ${weightSum === 100 ? 'ok' : 'bad'}`}>
            Total: {weightSum}% {weightSum === 100 ? '✓' : '(must be 100)'}
          </div>
        </section>

        <section className="card">
          <h3>Thresholds</h3>
          <label className="weight-row">
            <span>Mastery required to unlock next topic (%)</span>
            <input type="number" min={1} max={100} value={cfg.requiredPct}
                   onChange={(e) => set('requiredPct', Number(e.target.value))} />
          </label>
          <label className="weight-row">
            <span>Max quiz attempts</span>
            <input type="number" min={1} value={cfg.maxQuizAttempts}
                   onChange={(e) => set('maxQuizAttempts', Number(e.target.value))} />
          </label>
        </section>

        {error && <div className="error">{error}</div>}
        {saved && <div className="success-note">Saved ✓</div>}
        <button className="btn btn--primary btn--block" disabled={busy || weightSum !== 100} onClick={save}>
          {busy ? 'Saving...' : 'Save settings'}
        </button>

        <NotificationPrefs />
        <ChangePassword />
      </main>
    </div>
  )
}
