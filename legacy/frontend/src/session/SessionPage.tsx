import { useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AriaOwl from './components/AriaOwl'
import SessionTopbar from './components/SessionTopbar'
import DoneCard from './components/DoneCard'
import AskAria from './components/AskAria'
import EarlyLayout from './layouts/EarlyLayout'
import MiddleLayout from './layouts/MiddleLayout'
import SeniorLayout from './layouts/SeniorLayout'
import { Band, bandOverride } from './band'
import { SessionSource } from './types'
import { createApiSession } from './sources/apiSession'
import { createMockSession } from './sources/mockSession'
import { isMockSubject, MockSubject } from './sources/mockContent'
import { useSession } from './useSession'
import { useAuth } from '../auth'
import './session.css'

/**
 * The student's whole app: one screen, chosen for them.
 *
 * This replaces the dashboard as the child's landing page. The old dashboard listed
 * every topic with a mastery percentage, a status badge and six activity links each —
 * an adult's view of a child's progress, put in front of the child. None of it helped
 * them learn and all of it asked them to make a decision Aria is better placed to make.
 * The dashboard still exists at /student/dashboard for a parent sitting alongside.
 *
 * The child reaches it by picking a class on `/student` (see SubjectPicker.tsx), and the
 * chosen class arrives as `?gradeId=`. That is the only choice the child makes; the topic,
 * the difficulty and the order stay with Aria.
 *
 * Demo mode (`/student/session?demo=1`) runs the same screen against a scripted session,
 * so the experience can be shown and reviewed when the local AI engine is not running.
 * Add `&band=early|middle|senior` and `&subject=math|reading|science` to pick a script.
 */
export default function SessionPage() {
  const { search } = useLocation()
  // Re-key on the query string so switching demo band or subject starts a clean session
  // rather than swapping content underneath a half-answered question.
  return <SessionRunner key={search} search={search} />
}

function SessionRunner({ search }: { search: string }) {
  const { user } = useAuth()
  const params = new URLSearchParams(search)
  const demo = params.get('demo') === '1'
  const demoBand: Band = bandOverride(search) ?? 'early'
  const subjectParam = params.get('subject')
  const demoSubject: MockSubject = isMockSubject(subjectParam) ? subjectParam : 'math'
  const gradeId = params.get('gradeId')
  const userId = user?.id

  const makeSource = useCallback(
    (): SessionSource => (demo
      ? createMockSession(demoBand, demoSubject)
      : createApiSession(userId, gradeId)),
    [demo, demoBand, demoSubject, gradeId, userId],
  )

  const s = useSession(makeSource)

  /**
   * The microphone.
   *
   * Voice answers are not built yet. Rather than a dead button or a modal dialog, Aria
   * says so herself in the conversation the child already trusts — and the request is
   * left where a real speech handler will slot in.
   */
  const onMic = useCallback(() => {
    s.setChatOpen(true)
    s.ariaSays('I cannot hear you yet. Type it to me for now and I will answer.')
  }, [s])

  const band: Band = s.state?.band ?? demoBand

  return (
    <div className="sx-app" data-band={band}>
      {s.state && <SessionTopbar state={s.state} />}

      {s.phase === 'loading' && (
        <div className="sx-stage sx-stage--single">
          <div className="sx-card sx-done">
            <AriaOwl size={140} mood="think" />
            <h2>{s.state ? 'One moment…' : 'Getting today ready…'}</h2>
            <p className="sx-note">
              {s.state ? 'Aria is writing the next question.' : 'Aria is picking what you will work on.'}
            </p>
          </div>
        </div>
      )}

      {s.phase === 'error' && (
        <div className="sx-stage sx-stage--single">
          <div className="sx-card sx-done">
            <AriaOwl size={140} mood="think" />
            <h2>Aria cannot start just now</h2>
            <p className="sx-note">
              The lesson could not be prepared. A grown-up can check that the AI engine is
              running, then try again.
            </p>
            {s.error && <p className="sx-mono">{s.error}</p>}
            <div className="sx-actions" style={{ justifyContent: 'center' }}>
              <button className="sx-btn sx-btn--check" onClick={() => void s.restart()}>Try again</button>
              <Link className="sx-btn sx-btn--ghost" to="/student">Pick another class</Link>
              <Link className="sx-btn sx-btn--ghost" to="/student?demo=1">See the demo</Link>
            </div>
          </div>
        </div>
      )}

      {s.phase === 'done' && s.state && (
        <div className="sx-stage sx-stage--single">
          <DoneCard band={band} stars={s.stars} total={s.state.total} focus={s.state.focus}
                    onRestart={() => void s.restart()} />
        </div>
      )}

      {(s.phase === 'asking' || s.phase === 'graded') && s.state && (
        band === 'early' ? <EarlyLayout s={s} onMic={onMic} />
          : band === 'middle' ? <MiddleLayout s={s} onMic={onMic} />
            : <SeniorLayout s={s} onMic={onMic} />
      )}

      {/* One overlay for every band. The early band has no docked panel at all, and the
          other two lose theirs on a narrow screen — a child must always be able to ask. */}
      {s.chatOpen && (
        <div className="sx-overlay"
             onClick={(e) => { if (e.target === e.currentTarget) s.setChatOpen(false) }}>
          <AskAria band={band} turns={s.chat} onSend={(t) => void s.askAria(t)}
                   onClose={() => s.setChatOpen(false)} onMic={onMic} />
        </div>
      )}
    </div>
  )
}
