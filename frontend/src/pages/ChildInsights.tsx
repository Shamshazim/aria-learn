import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AdaptiveProfile, api, EnrolledSubject, Grade, ParentCharts, Report, StudentDto, Subject, TopicProgress } from '../api'
import { useAuth } from '../auth'
import AdvicePanel from '../components/AdvicePanel'
import InsightCharts from '../components/InsightCharts'

function ResetChildPassword({ studentId, name }: { studentId: string; name?: string }) {
  const [pwd, setPwd] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const reset = async () => {
    setErr(null); setMsg(null)
    if (pwd.length < 6) { setErr('Password must be at least 6 characters.'); return }
    setBusy(true)
    try { await api.resetChildPassword(studentId, pwd); setMsg('Password updated ✓'); setPwd('') }
    catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <section className="card">
      <h3>Password</h3>
      <p className="muted">Set a new password for {name ?? 'this child'}. Use something unique so the browser stops warning about it.</p>
      <div className="report-controls">
        <input type="text" placeholder="New password" value={pwd} onChange={(e) => setPwd(e.target.value)} style={{ width: 'auto', flex: 1 }} />
        <button className="btn btn--primary" disabled={busy} onClick={reset}>{busy ? 'Saving...' : 'Reset password'}</button>
      </div>
      {err && <div className="error">{err}</div>}
      {msg && <div className="success-note">{msg}</div>}
    </section>
  )
}

function EnrollSection({ studentId }: { studentId: string }) {
  const [enrolled, setEnrolled] = useState<EnrolledSubject[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [gradesBySubject, setGradesBySubject] = useState<Record<string, Grade[]>>({})
  const [subjectId, setSubjectId] = useState('')
  const [gradeId, setGradeId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const reload = () => api.childSubjects(studentId).then(setEnrolled).catch(() => {})

  // Cache the grade list for a subject (used by both the per-subject editor and the add form).
  const ensureGrades = (sid: string) => {
    if (!sid || gradesBySubject[sid]) return
    api.grades(sid).then((g) => setGradesBySubject((m) => ({ ...m, [sid]: g }))).catch(() => {})
  }

  useEffect(() => { reload(); api.subjects().then(setSubjects).catch(() => {}) }, [studentId])
  // Load grades for every subject the child is already enrolled in.
  useEffect(() => { enrolled.forEach((e) => ensureGrades(e.subjectId)) }, [enrolled])
  // Load grades for the subject chosen in the "add" picker and default its grade.
  useEffect(() => { if (subjectId) ensureGrades(subjectId) }, [subjectId])
  useEffect(() => {
    const g = gradesBySubject[subjectId]
    if (subjectId && g && g.length) setGradeId(g[0].id)
    if (!subjectId) setGradeId('')
  }, [gradesBySubject, subjectId])

  // Changing an enrolled subject's grade re-enrolls at the new grade (backend upserts per subject).
  const changeGrade = async (newGradeId: string, subjectName: string) => {
    setErr(null); setMsg(null); setBusy(true)
    try {
      await api.enrollChild(studentId, newGradeId)
      await reload()
      setMsg(`${subjectName} grade updated ✓`)
    } catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  const enroll = async () => {
    if (!gradeId) return
    setErr(null); setMsg(null)
    try { await api.enrollChild(studentId, gradeId); setSubjectId(''); await reload() }
    catch (e) { setErr((e as Error).message) }
  }

  const addable = subjects.filter((s) => !enrolled.some((e) => e.subjectId === s.id))

  return (
    <section className="card">
      <h3>Subjects &amp; grade</h3>
      <p className="muted">Change a subject's grade and this child will see the topics for the new grade.</p>

      {enrolled.length === 0 && <p className="muted">Not enrolled in any subject yet.</p>}
      <div className="enroll-list">
        {enrolled.map((e) => {
          const grades = gradesBySubject[e.subjectId] ?? []
          return (
            <div key={e.subjectId} className="enroll-row">
              <span className="enroll-subject">{e.subjectName}</span>
              <select value={e.gradeId} disabled={busy || grades.length === 0}
                      onChange={(ev) => changeGrade(ev.target.value, e.subjectName)}>
                {grades.length === 0 && <option value={e.gradeId}>{e.gradeName}</option>}
                {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )
        })}
      </div>

      {addable.length > 0 && (
        <div className="report-controls" style={{ marginTop: '0.9rem' }}>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Add a subject…</option>
            {addable.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {subjectId && (gradesBySubject[subjectId]?.length ?? 0) > 0 && (
            <select value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              {gradesBySubject[subjectId].map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <button className="btn btn--primary" disabled={!gradeId} onClick={enroll}>Enroll</button>
        </div>
      )}
      {err && <div className="error">{err}</div>}
      {msg && <div className="success-note">{msg}</div>}
    </section>
  )
}

const SCOPES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']

function ReportSection({ studentId }: { studentId: string }) {
  const [scope, setScope] = useState('WEEKLY')
  const [report, setReport] = useState<Report | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const generate = async () => {
    setBusy(true); setErr(null)
    try { setReport(await api.generateReport(studentId, scope)) }
    catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  const download = async () => {
    if (!report) return
    try {
      const blob = await api.reportPdf(report.reportId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `aria-report-${report.studentName.toLowerCase()}-${report.scope.toLowerCase()}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (e) { setErr((e as Error).message) }
  }

  return (
    <section className="card">
      <h3>Reports</h3>
      <div className="report-controls">
        <select value={scope} onChange={(e) => setScope(e.target.value)}>
          {SCOPES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </select>
        <button className="btn btn--primary" disabled={busy} onClick={generate}>
          {busy ? 'Generating...' : 'Generate report'}
        </button>
        {report && <button className="btn btn--accent" onClick={download}>⬇ Download PDF</button>}
      </div>
      {err && <div className="error">{err}</div>}
      {report && (
        <div className="report-preview">
          <p className="muted">{report.scope.charAt(0) + report.scope.slice(1).toLowerCase()} report · {report.periodStart} – {report.periodEnd}</p>
          <div className="report-stats">
            <span><strong>{report.accuracy}%</strong> accuracy</span>
            <span><strong>{report.masteredCount}</strong> mastered</span>
            <span><strong>{report.periodXp}</strong> XP this period</span>
            <span><strong>{report.activeDays}</strong> active days</span>
          </div>
          {report.advice && <p className="report-advice">🦉 {report.advice}</p>}
        </div>
      )}
    </section>
  )
}

const STATUS_LABEL: Record<string, string> = {
  MASTERED: '🏆 Mastered', IN_PROGRESS: '📈 In progress', AVAILABLE: '✨ Ready', LOCKED: '🔒 Locked',
}

export default function ChildInsights() {
  const { studentId } = useParams()
  const { logout } = useAuth()
  const [child, setChild] = useState<StudentDto | null>(null)
  const [profile, setProfile] = useState<AdaptiveProfile | null>(null)
  const [progress, setProgress] = useState<TopicProgress[]>([])
  const [charts, setCharts] = useState<ParentCharts | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!studentId) return
    api.listStudents().then((list) => setChild(list.find((s) => s.id === studentId) ?? null)).catch(() => {})
    api.childProfile(studentId).then(setProfile).catch((e) => setError((e as Error).message))
    api.childProgress(studentId).then(setProgress).catch(() => {})
    api.childCharts(studentId).then(setCharts).catch(() => {})
  }, [studentId])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">🦉 Aria <span className="muted">· Parent</span></div>
        <div className="topbar-right">
          <Link className="btn btn--ghost" to="/parent">← Dashboard</Link>
          <button className="btn btn--ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="container">
        <h2>Insights{child ? ` · ${child.displayName}` : ''}</h2>
        {error && <div className="error">{error}</div>}
        {studentId && <EnrollSection studentId={studentId} />}
        {studentId && <ResetChildPassword studentId={studentId} name={child?.displayName} />}
        {profile && <AdvicePanel profile={profile} childName={child?.displayName} />}
        {charts && <InsightCharts charts={charts} />}
        {studentId && <ReportSection studentId={studentId} />}

        <section className="card">
          <h3>Topic progress</h3>
          {progress.length === 0 && <p className="muted">No activity yet.</p>}
          <ul className="student-list">
            {progress.map((t) => (
              <li key={t.topicId} className="student-row">
                <div style={{ flex: 1 }}>
                  <div className="student-name">{t.topicName}</div>
                  <div className="muted">{t.unitName}</div>
                </div>
                <span className={`status-badge status-${t.status.toLowerCase()}`}>{STATUS_LABEL[t.status]}</span>
                <span className="mastery-pct" style={{ marginLeft: '0.8rem' }}>{t.masteryScore}%</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
