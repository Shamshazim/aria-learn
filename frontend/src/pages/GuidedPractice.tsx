import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, Lightbulb, PartyPopper } from 'lucide-react'
import { api, GuidedFeedback, GuidedQuestion } from '../api'
import QuestionRenderer from '../components/QuestionRenderer'
import { celebrateCorrect } from '../lib/celebrate'

export default function GuidedPractice() {
  const { topicId } = useParams()
  const [question, setQuestion] = useState<GuidedQuestion | null>(null)
  const [value, setValue] = useState('')
  const [attempt, setAttempt] = useState(1)
  const [hints, setHints] = useState<string[]>([])
  const [feedback, setFeedback] = useState<GuidedFeedback | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const newQuestion = () => {
    if (!topicId) return
    setQuestion(null); setValue(''); setAttempt(1); setHints([]); setFeedback(null); setError(null)
    api.guidedStart(topicId).then(setQuestion).catch((e) => setError((e as Error).message))
  }

  useEffect(newQuestion, [topicId])

  const submit = async () => {
    if (!question || !value.trim()) return
    setBusy(true)
    try {
      const fb = await api.guidedAttempt(question.questionId, value, attempt)
      if (fb.correct) {
        setFeedback(fb)
        celebrateCorrect()
      } else {
        setHints((h) => [...h, fb.hint ?? 'Keep trying!'])
        setAttempt((a) => a + 1)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const showSolution = async () => {
    if (!question) return
    setBusy(true)
    try {
      setFeedback(await api.guidedSolution(question.questionId))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell student-theme">
      <header className="topbar">
        <div className="brand">🦉 Aria · Guided</div>
        <Link className="btn btn--ghost" to="/student"><ArrowLeft size={16} /> Back</Link>
      </header>

      <main className="container narrow">
        {!question && !error && (
          <div className="card thinking"><div className="spinner" /><p>Aria is picking a problem for you...</p></div>
        )}
        {error && <div className="error">{error}</div>}

        {question && (
          <div className="card practice">
            <div className="muted">Aria is right here with you 🤝</div>
            <h2 className="q-prompt">{question.prompt}</h2>

            <QuestionRenderer
              question={{ ...question, difficulty: '' }}
              value={value}
              onChange={setValue}
              disabled={!!feedback}
              correctAnswer={feedback?.correctAnswer}
            />

            {hints.map((h, i) => (
              <div key={i} className="hint-bubble"><Lightbulb size={16} /> {h}</div>
            ))}

            {!feedback && (
              <div className="guided-actions">
                <button className="btn btn--primary" disabled={busy || !value.trim()} onClick={submit}>
                  {busy ? 'Thinking...' : attempt === 1 ? 'Check my answer' : 'Try again'}
                </button>
                {attempt > 2 && (
                  <button className="btn btn--ghost" disabled={busy} onClick={showSolution}>
                    <Eye size={16} /> Show me how
                  </button>
                )}
              </div>
            )}

            {feedback && (
              <div className={`feedback ${feedback.correct ? 'feedback--ok' : 'feedback--no'}`}>
                <div className={`feedback-head ${feedback.correct ? 'feedback-head--pop' : ''}`}>
                  {feedback.correct
                    ? <><PartyPopper size={22} /> You got it!</>
                    : <><Eye size={22} /> Here is how to solve it</>}
                </div>
                {feedback.correctAnswer && !feedback.correct && (
                  <div>The answer is <strong>{feedback.correctAnswer}</strong>.</div>
                )}
                {feedback.solution && <p className="solution">{feedback.solution}</p>}
                <button className="btn btn--accent btn--block" onClick={newQuestion}>Another problem <ArrowRight size={16} /></button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
