import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import KidHeader from '../components/KidHeader'
import { ArrowLeft, CheckCircle2, Dumbbell, Trophy, XCircle } from 'lucide-react'
import { api, QuizDto, QuizResult } from '../api'
import QuestionRenderer from '../components/QuestionRenderer'
import Timer from '../components/Timer'
import FunLoader from '../components/FunLoader'
import ReportQuestion from '../components/ReportQuestion'
import { celebrateBig } from '../lib/celebrate'
import { markStepDone } from '../lib/steps'
import { useAuth } from '../auth'

export default function Quiz() {
  const { topicId } = useParams()
  const { user } = useAuth()
  const [quiz, setQuiz] = useState<QuizDto | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    if (!topicId) return
    setQuiz(null); setAnswers({}); setResult(null); setError(null)
    api.quizStart(topicId).then(setQuiz).catch((e) => setError((e as Error).message))
  }
  useEffect(load, [topicId])

  const submit = useCallback(async () => {
    if (!quiz || result || submitting) return
    setSubmitting(true)
    try {
      const payload = quiz.questions.map((q) => ({
        questionId: q.questionId,
        response: answers[q.questionId] ?? '',
      }))
      const r = await api.quizSubmit(quiz.attemptId, payload)
      setResult(r)
      markStepDone(user?.id, topicId, 'quiz')
      if (r.passed) celebrateBig()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }, [quiz, answers, result, submitting, user?.id, topicId])

  return (
    <div className="app-shell student-theme">
      <KidHeader subtitle="Quiz" right={<>
        {quiz && !result && <Timer seconds={quiz.timeLimitSec} onExpire={submit} />}
        <Link className="btn btn--ghost" to="/student"><ArrowLeft size={16} /> Back</Link>
      </>} />

      <main className="container narrow">
        {!quiz && !error && (
          <FunLoader variant="quiz" />
        )}
        {error && <div className="error">{error}</div>}

        {quiz && !result && (
          <>
            <div className="card card--hero">
              <h1>Quiz time! 📝</h1>
              <p>{quiz.questions.length} questions · pass at {quiz.passingPct}%</p>
            </div>
            {quiz.questions.map((q, i) => (
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
              {submitting ? 'Grading...' : 'Submit quiz'}
            </button>
          </>
        )}

        {result && (
          <>
            <div className={`card result-banner ${result.passed ? 'pass' : 'fail'}`}>
              <h1 className={result.passed ? 'feedback-head--pop' : ''}>
                {result.passed
                  ? <><Trophy size={28} /> You passed!</>
                  : <><Dumbbell size={28} /> Keep practicing</>}
              </h1>
              <div className="score">{result.scorePct}%</div>
              <p>{result.correct} of {result.total} correct</p>
            </div>
            {result.results.map((r, i) => (
              <div key={r.questionId} className={`card review ${r.correct ? 'review--ok' : 'review--no'}`}>
                <div className="muted review-status">Question {i + 1} · {r.correct
                  ? <><CheckCircle2 size={15} className="ic-ok" /> Correct</>
                  : <><XCircle size={15} className="ic-no" /> Incorrect</>}</div>
                <h4>{r.prompt}</h4>
                <div>Your answer: <strong>{r.yourAnswer || '—'}</strong></div>
                {r.feedback && <p className="feedback-text">🦉 {r.feedback}</p>}
                {!r.correct && <div>One correct answer: <strong>{r.correctAnswer}</strong></div>}
                {r.solution && <p className="solution">{r.solution}</p>}
                <ReportQuestion questionId={r.questionId} />
              </div>
            ))}
            <div className="done">
              <button className="btn btn--primary" onClick={load}>Try a new quiz</button>
              <Link className="btn btn--ghost" to="/student">Back to lessons</Link>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
