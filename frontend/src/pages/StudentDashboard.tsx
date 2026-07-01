import { ReactNode, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen, ClipboardCheck, Handshake, House, Lock, LogOut, PencilLine,
  Search, Sparkles, TrendingUp, Trophy,
} from 'lucide-react'
import {
  AdaptiveProfile, api, EnrolledSubject, GamificationSummary, HomeworkSummary, StudentProfile, TopicProgress,
} from '../api'
import { useAuth } from '../auth'
import AdvicePanel from '../components/AdvicePanel'
import GamePanel from '../components/GamePanel'
import NotificationBell from '../components/NotificationBell'
import ChangePassword from '../components/ChangePassword'

const STATUS_LABEL: Record<string, ReactNode> = {
  MASTERED: <><Trophy size={14} /> Mastered</>,
  IN_PROGRESS: <><TrendingUp size={14} /> In progress</>,
  AVAILABLE: <><Sparkles size={14} /> Ready</>,
  LOCKED: <><Lock size={14} /> Locked</>,
}

// Where a recommendation should take the student.
function recLink(type: string, topicId: string | null): string | null {
  if (!topicId) return null
  if (type === 'REVIEW' || type === 'SCHEDULE_REVIEW') return `/student/topic/${topicId}/knowledge`
  return `/student/topic/${topicId}/practice` // MORE_PRACTICE / INCREASE_DIFFICULTY
}

function groupByUnit(topics: TopicProgress[]) {
  const units = new Map<string, TopicProgress[]>()
  for (const t of topics) {
    if (!units.has(t.unitName)) units.set(t.unitName, [])
    units.get(t.unitName)!.push(t)
  }
  return [...units.entries()]
}

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const [me, setMe] = useState<StudentProfile | null>(null)
  const [topics, setTopics] = useState<TopicProgress[]>([])
  const [adaptive, setAdaptive] = useState<AdaptiveProfile | null>(null)
  const [game, setGame] = useState<GamificationSummary | null>(null)
  const [homework, setHomework] = useState<HomeworkSummary[]>([])
  const [subjects, setSubjects] = useState<EnrolledSubject[]>([])
  const [gradeId, setGradeId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Global, once: profile, gamification, homework, and the list of subjects.
  useEffect(() => {
    api.me().then(setMe).catch(() => {})
    api.gamification().then(setGame).catch(() => {})
    api.listHomework().then(setHomework).catch(() => {})
    api.studentSubjects().then((s) => {
      setSubjects(s)
      if (s[0]) setGradeId(s[0].gradeId)
    }).catch(() => {})
  }, [])

  // Per-subject: progress + recommendations for the selected subject.
  useEffect(() => {
    api.progress(gradeId ?? undefined).then(setTopics).catch((e) => setError((e as Error).message))
    api.studentProfile(gradeId ?? undefined).then(setAdaptive).catch(() => {})
  }, [gradeId])

  const currentSubject = subjects.find((s) => s.gradeId === gradeId)

  const continueTopic = topics.find((t) => t.status === 'IN_PROGRESS') ?? topics.find((t) => t.status === 'AVAILABLE')
  const pendingHw = homework.filter((h) => h.status !== 'EVALUATED')
  const recentFeedback = homework.filter((h) => h.status === 'EVALUATED').slice(0, 3)
  const topRec = adaptive?.recommendations.find((r) => recLink(r.type, r.topicId) != null)

  return (
    <div className="app-shell student-theme">
      <header className="topbar">
        <div className="brand">🦉 Aria</div>
        <div className="topbar-right">
          <NotificationBell />
          <span className="muted">Hi, {user?.displayName}!</span>
          <button className="btn btn--ghost" onClick={logout}><LogOut size={16} /> Sign out</button>
        </div>
      </header>

      <main className="container">
        {subjects.length > 1 && (
          <div className="subject-tabs">
            {subjects.map((s) => (
              <button key={s.subjectId}
                      className={`subject-tab ${s.gradeId === gradeId ? 'subject-tab--active' : ''}`}
                      onClick={() => setGradeId(s.gradeId)}>
                {s.subjectName}
              </button>
            ))}
          </div>
        )}

        <div className="greeting card card--hero">
          <h1>Welcome back, {me?.displayName ?? user?.displayName} 🌟</h1>
          <p>{currentSubject ? `${currentSubject.gradeName} · ${currentSubject.subjectName}` : 'Loading your lessons...'}</p>
          {continueTopic && (
            <Link className="btn btn--accent btn--continue" to={`/student/topic/${continueTopic.topicId}/knowledge`}>
              {continueTopic.status === 'IN_PROGRESS' ? 'Continue' : 'Start'}: {continueTopic.topicName} →
            </Link>
          )}
        </div>

        {error && <div className="error">{error}</div>}

        {/* Today's tasks */}
        <div className="today-grid">
          <div className="card today-card">
            <div className="today-icon">📘</div>
            <h3>Today's lesson</h3>
            {continueTopic
              ? <Link to={`/student/topic/${continueTopic.topicId}/knowledge`}>{continueTopic.topicName}</Link>
              : <p className="muted">All caught up! 🎉</p>}
          </div>
          <div className="card today-card">
            <div className="today-icon">🏠</div>
            <h3>Homework</h3>
            {pendingHw.length > 0
              ? <Link to={`/student/topic/${pendingHw[0].topicId}/homework`}>{pendingHw.length} to do →</Link>
              : <p className="muted">Nothing due. Nice!</p>}
          </div>
          <div className="card today-card">
            <div className="today-icon">🎯</div>
            <h3>Recommended</h3>
            {topRec
              ? <Link to={recLink(topRec.type, topRec.topicId)!}>{topRec.topicName}</Link>
              : <p className="muted">Keep up the great work!</p>}
          </div>
        </div>

        {game && <GamePanel game={game} />}

        {recentFeedback.length > 0 && (
          <div className="card">
            <h3>Recent feedback from Aria</h3>
            <ul className="feedback-summary-list">
              {recentFeedback.map((h) => (
                <li key={h.homeworkId}>
                  <Link to={`/student/topic/${h.topicId}/homework`}>
                    📝 {h.topicName} — <strong>{h.score}%</strong>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {adaptive && <AdvicePanel profile={adaptive} />}

        <h2>All topics</h2>
        {groupByUnit(topics).map(([unitName, unitTopics]) => (
          <section key={unitName}>
            <h3 className="unit-heading">{unitName}</h3>
            <div className="topic-grid">
              {unitTopics.map((t) => {
                const locked = t.status === 'LOCKED'
                return (
                  <div key={t.topicId} className={`card topic-card ${locked ? 'topic-card--locked' : ''}`}>
                    <div className="topic-status-row">
                      <span className={`status-badge status-${t.status.toLowerCase()}`}>{STATUS_LABEL[t.status]}</span>
                      {t.status !== 'LOCKED' && t.status !== 'AVAILABLE' && (
                        <span className="mastery-pct">{t.masteryScore}%</span>
                      )}
                    </div>
                    <div className="topic-title">{t.topicName}</div>
                    {locked ? (
                      <div className="locked-note">Master the previous topic to unlock this one.</div>
                    ) : (
                      <div className="topic-flow">
                        <Link className="flow-step" to={`/student/topic/${t.topicId}/knowledge`}><BookOpen size={15} /> Learn</Link>
                        <Link className="flow-step" to={`/student/topic/${t.topicId}/examples`}><Search size={15} /> Examples</Link>
                        <Link className="flow-step" to={`/student/topic/${t.topicId}/guided`}><Handshake size={15} /> Guided</Link>
                        <Link className="flow-step" to={`/student/topic/${t.topicId}/practice`}><PencilLine size={15} /> Practice</Link>
                        <Link className="flow-step flow-step--quiz" to={`/student/topic/${t.topicId}/quiz`}><ClipboardCheck size={15} /> Quiz</Link>
                        <Link className="flow-step flow-step--hw" to={`/student/topic/${t.topicId}/homework`}><House size={15} /> Homework</Link>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        <details className="account-details">
          <summary>⚙️ Account settings</summary>
          <ChangePassword />
        </details>
      </main>
    </div>
  )
}
