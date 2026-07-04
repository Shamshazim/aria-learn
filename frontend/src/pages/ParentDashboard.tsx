import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flag } from 'lucide-react'
import { api, ChildSummary, Grade, ParentSettings, Subject } from '../api'
import { useAuth } from '../auth'
import NotificationBell from '../components/NotificationBell'

export default function ParentDashboard() {
  const { user, logout } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [children, setChildren] = useState<ChildSummary[]>([])
  const [form, setForm] = useState({ displayName: '', username: '', password: '', subjectId: '', gradeId: '' })
  const [settings, setSettings] = useState<ParentSettings | null>(null)
  const [flagCount, setFlagCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reloadOverview = () => api.parentOverview().then(setChildren).catch(() => {})

  useEffect(() => {
    api.subjects().then((subs) => {
      setSubjects(subs)
      // Default to Mathematics when present so children start in a subject that has content.
      const preferred = subs.find((s) => s.slug === 'math') ?? subs[0]
      if (preferred) setForm((f) => ({ ...f, subjectId: preferred.id }))
    })
    reloadOverview()
    api.getParentSettings().then(setSettings).catch(() => {})
    api.parentFlags().then((f) => setFlagCount(f.length)).catch(() => {})
  }, [])

  // Load grades whenever the chosen subject changes.
  useEffect(() => {
    if (!form.subjectId) { setGrades([]); return }
    api.grades(form.subjectId).then((g) => {
      setGrades(g)
      setForm((f) => ({ ...f, gradeId: g[0]?.id ?? '' }))
    }).catch(() => setGrades([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.subjectId])

  const createStudent = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api.createStudent({
        displayName: form.displayName, username: form.username,
        password: form.password, gradeId: form.gradeId,
      })
      setForm((f) => ({ ...f, displayName: '', username: '', password: '' }))
      await reloadOverview()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const toggleAutoAssign = async () => {
    if (!settings) return
    const next = { autoAssignHomework: !settings.autoAssignHomework }
    setSettings(next)
    try { await api.updateParentSettings(next) } catch { setSettings(settings) }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">🦉 Aria <span className="muted">· Parent</span></div>
        <div className="topbar-right">
          <NotificationBell />
          <Link className="btn btn--ghost" to="/parent/curriculum">📚 Curriculum</Link>
          <Link className="btn btn--ghost" to="/parent/prompts">🤖 Prompts</Link>
          <Link className="btn btn--ghost" to="/parent/flags">
            <Flag size={15} /> Reported{flagCount > 0 && <span className="flag-badge">{flagCount}</span>}
          </Link>
          <Link className="btn btn--ghost" to="/parent/mastery-config">⚙️ Mastery settings</Link>
          <span className="muted">{user?.displayName}</span>
          <button className="btn btn--ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="container">
        <h2>Your children</h2>
        {children.length === 0 && <p className="muted">No children yet. Add one below to get started.</p>}
        <div className="overview-grid">
          {children.map((c) => (
            <Link key={c.studentId} to={`/parent/students/${c.studentId}/insights`} className="card child-card">
              <div className="child-card-head">
                <span className="avatar">{c.displayName.charAt(0).toUpperCase()}</span>
                <div>
                  <div className="student-name">{c.displayName}</div>
                  <div className="muted">Level {c.level} · {c.xpTotal} XP</div>
                </div>
                <span className="streak-flame">🔥 {c.streak}</span>
              </div>
              <div className="child-stats">
                <div className="cstat"><span className="cstat-num">{c.masteredCount}</span><span className="cstat-label">mastered</span></div>
                <div className="cstat"><span className="cstat-num">{c.inProgressCount}</span><span className="cstat-label">in progress</span></div>
                <div className="cstat"><span className="cstat-num">{c.accuracy}%</span><span className="cstat-label">accuracy</span></div>
              </div>
              <div className="goal-bar">
                <div className="goal-fill" style={{ width: `${c.weeklyTarget > 0 ? Math.min(100, (c.weeklyActivities / c.weeklyTarget) * 100) : 0}%` }} />
              </div>
              <div className="muted child-week">{c.weeklyActivities}/{c.weeklyTarget} activities this week · View insights →</div>
            </Link>
          ))}
        </div>

        <h2>Manage</h2>
        <div className="grid">
          <section className="card">
            <h3>Add a child</h3>
            <form onSubmit={createStudent}>
              <label>Name<input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
              <label>Username<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
              <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
              <label>
                Subject
                <select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label>
                Grade
                <select value={form.gradeId} onChange={(e) => setForm({ ...form, gradeId: e.target.value })}>
                  {grades.length === 0 && <option value="">No grades yet for this subject</option>}
                  {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
              {error && <div className="error">{error}</div>}
              <button className="btn btn--primary" disabled={busy || !subjects.length}>
                {busy ? 'Adding...' : 'Add child'}
              </button>
            </form>
          </section>

          <section className="card">
            <h3>Homework</h3>
            <label className="toggle-row">
              <span>Auto-assign homework after each quiz</span>
              <button
                type="button"
                className={`toggle ${settings?.autoAssignHomework ? 'toggle--on' : ''}`}
                onClick={toggleAutoAssign}
                disabled={!settings}
                aria-pressed={!!settings?.autoAssignHomework}
              >
                <span className="toggle-knob" />
              </button>
            </label>
            <p className="muted">When on, Aria assigns homework automatically once a child finishes a quiz.</p>
          </section>
        </div>
      </main>
    </div>
  )
}
