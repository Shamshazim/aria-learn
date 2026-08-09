import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import Login from './pages/Login'
import Setup from './pages/Setup'
import ParentDashboard from './pages/ParentDashboard'
import MasteryConfigPage from './pages/MasteryConfigPage'
import ChildInsights from './pages/ChildInsights'
import CurriculumAdminPage from './pages/CurriculumAdminPage'
import PromptAdminPage from './pages/PromptAdminPage'
import FlaggedQuestions from './pages/FlaggedQuestions'
import StudentDashboard from './pages/StudentDashboard'
import Resources from './pages/Resources'
import MultiplicationChart from './pages/MultiplicationChart'
import AdditionChart from './pages/AdditionChart'
import HundredsChart from './pages/HundredsChart'
import SightWords from './pages/SightWords'
import Knowledge from './pages/Knowledge'
import Practice from './pages/Practice'
import Examples from './pages/Examples'
import GuidedPractice from './pages/GuidedPractice'
import Quiz from './pages/Quiz'
import Homework from './pages/Homework'
import { ReactNode, useEffect, useState } from 'react'
import { api, Role } from './api'

/**
 * Sends a brand-new installation to the setup wizard before anything else can render.
 *
 * Without this a parent opening the app for the first time would meet a sign-in form with
 * no account to sign in to. The check runs once per app load and is skipped entirely once
 * an account exists.
 *
 * If the status call fails we assume the app is configured and fall through to the normal
 * routes: a transient error should surface as a normal sign-in failure, not trap someone
 * with an existing account in a setup screen that will refuse them.
 */
function SetupGate({ children }: { children: ReactNode }) {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    api.setupStatus()
      .then((s) => { if (!cancelled) setConfigured(s.configured) })
      .catch(() => { if (!cancelled) setConfigured(true) })
    return () => { cancelled = true }
  }, [])

  if (configured === null) {
    return (
      <div className="auth-screen">
        <div className="card auth-card">
          <div className="mascot">🦉</div>
          <p className="muted">Waking Aria up...</p>
        </div>
      </div>
    )
  }

  if (!configured && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />
  }
  return <>{children}</>
}

function Protected({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={user.role === 'PARENT' ? '/parent' : '/student'} replace />
  return <>{children}</>
}

function Home() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'PARENT' ? '/parent' : '/student'} replace />
}

export default function App() {
  return (
    <SetupGate>
    <Routes>
      <Route path="/setup" element={<Setup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/parent" element={<Protected role="PARENT"><ParentDashboard /></Protected>} />
      <Route path="/parent/mastery-config" element={<Protected role="PARENT"><MasteryConfigPage /></Protected>} />
      <Route path="/parent/students/:studentId/insights" element={<Protected role="PARENT"><ChildInsights /></Protected>} />
      <Route path="/parent/curriculum" element={<Protected role="PARENT"><CurriculumAdminPage /></Protected>} />
      <Route path="/parent/prompts" element={<Protected role="PARENT"><PromptAdminPage /></Protected>} />
      <Route path="/parent/flags" element={<Protected role="PARENT"><FlaggedQuestions /></Protected>} />
      <Route path="/student" element={<Protected role="STUDENT"><StudentDashboard /></Protected>} />
      <Route path="/student/resources" element={<Protected role="STUDENT"><Resources /></Protected>} />
      <Route path="/student/resources/multiplication" element={<Protected role="STUDENT"><MultiplicationChart /></Protected>} />
      <Route path="/student/resources/addition" element={<Protected role="STUDENT"><AdditionChart /></Protected>} />
      <Route path="/student/resources/hundreds-chart" element={<Protected role="STUDENT"><HundredsChart /></Protected>} />
      <Route path="/student/resources/sight-words" element={<Protected role="STUDENT"><SightWords /></Protected>} />
      <Route path="/student/topic/:topicId/knowledge" element={<Protected role="STUDENT"><Knowledge /></Protected>} />
      <Route path="/student/topic/:topicId/examples" element={<Protected role="STUDENT"><Examples /></Protected>} />
      <Route path="/student/topic/:topicId/guided" element={<Protected role="STUDENT"><GuidedPractice /></Protected>} />
      <Route path="/student/topic/:topicId/practice" element={<Protected role="STUDENT"><Practice /></Protected>} />
      <Route path="/student/topic/:topicId/quiz" element={<Protected role="STUDENT"><Quiz /></Protected>} />
      <Route path="/student/topic/:topicId/homework" element={<Protected role="STUDENT"><Homework /></Protected>} />
      <Route path="/" element={<Home />} />
      <Route path="*" element={<Home />} />
    </Routes>
    </SetupGate>
  )
}
