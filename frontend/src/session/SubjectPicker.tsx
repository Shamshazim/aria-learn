import { CSSProperties, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, LogOut } from 'lucide-react'
import { api, EnrolledSubject } from '../api'
import { useAuth } from '../auth'
import AriaOwl from './components/AriaOwl'
import { Band, bandForGrade, bandOverride } from './band'
import { faceFor } from './subjects'
import './session.css'

/**
 * The child's front door: which class am I doing right now?
 *
 * This is the one choice the child makes. Everything after it — the topic, the
 * difficulty, the order, when to stop — stays with Aria, because a child picking a
 * topic picks the one they are already good at. Subject is different: it is the child's
 * own sense of what they have energy for today, and it costs the teaching nothing.
 *
 * The list is what the child is actually enrolled in, so a new subject in the curriculum
 * appears here with no change to this file.
 */
export default function SubjectPicker() {
  const { search } = useLocation()
  const { logout } = useAuth()
  const demo = new URLSearchParams(search).get('demo') === '1'
  const demoBand: Band = bandOverride(search) ?? 'early'

  const [name, setName] = useState('')
  const [band, setBand] = useState<Band>(demo ? demoBand : 'middle')
  const [subjects, setSubjects] = useState<EnrolledSubject[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (demo) {
      setName(demoBand === 'early' ? 'Mia' : demoBand === 'middle' ? 'Noah' : 'Sofia')
      setSubjects(DEMO_SUBJECTS)
      return
    }
    let live = true
    setError(null)
    Promise.all([api.me(), api.studentSubjects()])
      .then(([me, list]) => {
        if (!live) return
        setName(me.displayName.split(' ')[0])
        // A subject's own grade decides the band, not the profile's default subject: a
        // child can sit in Grade 1 maths and Grade 3 reading, and each should look its age.
        setBand(bandForGrade(list[0]?.gradeName ?? me.gradeName))
        setSubjects(list)
      })
      .catch((e) => { if (live) setError((e as Error).message) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, demoBand])

  const early = band === 'early'

  return (
    <div className="sx-app" data-band={band}>
      <header className="sx-topbar">
        <div className="sx-brand"><AriaOwl size={34} avatar /> Aria Learn</div>
        <div className="sx-topbar-right">
          <span className="sx-rule" />
          <Link className="sx-linkbtn" to="/student/dashboard" aria-label="Open the full dashboard">
            <LayoutDashboard size={18} />
          </Link>
          <button className="sx-linkbtn" onClick={logout} aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="sx-stage sx-stage--pick">
        <div className="sx-pick">
          <div className="sx-pick-head">
            <AriaOwl size={early ? 150 : 92} mood="idle" />
            <div>
              <h1 className="sx-pick-title">
                {name ? `Hello, ${name}!` : 'Hello!'}
              </h1>
              <p className="sx-pick-sub">
                {early ? 'What shall we do today?' : 'Pick a class and I will take it from there.'}
              </p>
            </div>
          </div>

          {/* The error only earns the screen when there is nothing better on it. A list
              that loaded once already is more use to the child than a message about a
              later call that failed. */}
          {error && !subjects?.length && (
            <div className="sx-card sx-done">
              <h2>I cannot load your classes</h2>
              <p className="sx-note">A grown-up can check that the app is connected, then try again.</p>
              <p className="sx-mono">{error}</p>
              <div className="sx-actions" style={{ justifyContent: 'center' }}>
                <Link className="sx-btn sx-btn--ghost" to="/student?demo=1">See the demo</Link>
                <Link className="sx-btn sx-btn--ghost" to="/student/dashboard">Open the dashboard</Link>
              </div>
            </div>
          )}

          {!error && subjects === null && <p className="sx-pick-sub">Getting your classes…</p>}

          {!error && subjects !== null && subjects.length === 0 && (
            <div className="sx-card sx-done">
              <h2>Nothing is set up yet</h2>
              <p className="sx-note">Ask a grown-up to add a class for you, then come back.</p>
            </div>
          )}

          {subjects !== null && subjects.length > 0 && (
            <div className="sx-pick-grid">
              {subjects.map((s) => {
                const face = faceFor(s.subjectName)
                const to = demo
                  ? `/student/session?demo=1&band=${band}&subject=${s.subjectId}`
                  : `/student/session?gradeId=${encodeURIComponent(s.gradeId)}`
                return (
                  // The two colours go in as custom properties rather than as `background`
                  // and `borderColor` directly, so each band can decide what to do with
                  // them: the younger bands fill the card, the senior band takes a 3px edge
                  // and leaves the card white.
                  <Link key={s.gradeId} className="sx-subject" to={to}
                        style={{ '--face-tint': face.tint, '--face-edge': face.edge } as CSSProperties}>
                    <span className="sx-subject-face" aria-hidden="true">{face.emoji}</span>
                    <span className="sx-subject-name">{s.subjectName}</span>
                    {!early && <span className="sx-subject-note">{face.note}</span>}
                    {!early && s.gradeName && <span className="sx-subject-grade">{s.gradeName}</span>}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Demo mode's classes. The ids double as the mock-script keys, so picking "Reading" here
 * lands on the reading script in `sources/mockContent.ts` with the AI engine switched off.
 */
const DEMO_SUBJECTS: EnrolledSubject[] = [
  { subjectId: 'math', subjectName: 'Math', gradeId: 'math', gradeName: '' },
  { subjectId: 'reading', subjectName: 'Reading', gradeId: 'reading', gradeName: '' },
  { subjectId: 'science', subjectName: 'Science', gradeId: 'science', gradeName: '' },
]
