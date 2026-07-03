import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api, HomeworkDetail, HomeworkResult } from '../api'
import QuestionRenderer from '../components/QuestionRenderer'
import NextStepButton from '../components/NextStepButton'
import FunLoader from '../components/FunLoader'
import { markStepDone } from '../lib/steps'
import { useAuth } from '../auth'

export default function Homework() {
  const { topicId } = useParams()
  const { user } = useAuth()
  const [hw, setHw] = useState<HomeworkDetail | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<HomeworkResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const pollRef = useRef<number | null>(null)

  // Open (or generate) the homework for this topic.
  useEffect(() => {
    if (!topicId) return
    setHw(null); setResult(null); setError(null); setAnswers({})
    api.openHomework(topicId)
      .then((d) => {
        setHw(d)
        if (d.status === 'EVALUATED') void loadResult(d.homeworkId)
        else if (d.status === 'EVALUATING') startPolling(d.homeworkId)
      })
      .catch((e) => setError((e as Error).message))
    return () => { if (pollRef.current) window.clearInterval(pollRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId])

  const loadResult = useCallback(async (homeworkId: string) => {
    const r = await api.homeworkResult(homeworkId)
    if (r.status === 'EVALUATED') {
      setResult(r)
      markStepDone(user?.id, topicId, 'homework')
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null }
    }
    return r
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startPolling = useCallback((homeworkId: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = window.setInterval(() => { void loadResult(homeworkId) }, 2500)
  }, [loadResult])

  const submit = async () => {
    if (!hw) return
    setSubmitting(true)
    try {
      const payload = hw.questions.map((q) => ({ questionId: q.questionId, response: answers[q.questionId] ?? '' }))
      const r = await api.submitHomework(hw.homeworkId, payload)
      setHw({ ...hw, status: r.status })
      startPolling(hw.homeworkId)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const reviewing = hw?.status === 'EVALUATING' && !result

  return (
    <div className="app-shell student-theme">
      <header className="topbar">
        <div className="brand">🦉 Aria · Homework</div>
        <Link className="btn btn--ghost" to="/student"><ArrowLeft size={16} /> Back</Link>
      </header>

      <main className="container narrow">
        {!hw && !error && (
          <FunLoader variant="homework" />
        )}
        {error && <div className="error">{error}</div>}

        {reviewing && <FunLoader variant="review" />}

        {hw && hw.status === 'ASSIGNED' && !reviewing && (
          <>
            <div className="card card--hero">
              <h1>Homework: {hw.topicName} 🏠</h1>
              <p>{hw.questions.length} questions · take your time</p>
            </div>
            {hw.questions.map((q, i) => (
              <div key={q.questionId} className="card">
                <div className="muted">Question {i + 1}</div>
                <h3 className="q-prompt">{q.prompt}</h3>
                <QuestionRenderer
                  question={{ ...q, difficulty: '' }}
                  value={answers[q.questionId] ?? ''}
                  onChange={(v) => setAnswers((a) => ({ ...a, [q.questionId]: v }))}
                />
              </div>
            ))}
            <button className="btn btn--primary btn--block" disabled={submitting} onClick={submit}>
              {submitting ? 'Sending to Aria...' : 'Submit homework'}
            </button>
          </>
        )}

        {result && (
          <>
            <div className={`card result-banner ${(result.overallScore ?? 0) >= 70 ? 'pass' : 'fail'}`}>
              <h1>Homework reviewed ✅</h1>
              <div className="score">{result.overallScore}%</div>
              <p>{result.summary}</p>
            </div>
            {result.recommendations && (
              <div className="card summary">💡 {result.recommendations}</div>
            )}
            {result.results.map((r, i) => (
              <div key={r.questionId} className={`card review ${r.correct ? 'review--ok' : 'review--no'}`}>
                <div className="topic-status-row">
                  <span className="muted">Question {i + 1}</span>
                  <span className="mastery-pct">{r.partialCredit}%</span>
                </div>
                <h4>{r.prompt}</h4>
                <div>Your answer: <strong>{r.yourAnswer || '—'}</strong></div>
                {!r.correct && <div>Correct answer: <strong>{r.correctAnswer}</strong></div>}
                {r.feedback && <p className="feedback-text">🦉 {r.feedback}</p>}
                {r.misconception && <div className="misconception">To review: {r.misconception}</div>}
              </div>
            ))}
            <div className="done">
              <NextStepButton topicId={topicId!} current="homework" />
              <Link className="btn btn--ghost" to="/student">Back to lessons</Link>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
