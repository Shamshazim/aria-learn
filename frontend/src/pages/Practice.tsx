import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, HelpCircle, RotateCcw, Star } from 'lucide-react'
import { api, AnswerResult, PracticeSet } from '../api'
import QuestionRenderer from '../components/QuestionRenderer'
import NextStepButton from '../components/NextStepButton'
import FunLoader from '../components/FunLoader'
import ReportQuestion from '../components/ReportQuestion'
import { celebrateBig, celebrateCorrect } from '../lib/celebrate'
import { markStepDone } from '../lib/steps'
import { useAuth } from '../auth'

export default function Practice() {
  const { topicId } = useParams()
  const { user } = useAuth()
  const [set, setSet] = useState<PracticeSet | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [score, setScore] = useState(0)

  const load = () => {
    if (!topicId) return
    setSet(null); setError(null); setIndex(0); setValue(''); setResult(null); setScore(0)
    // AUTO lets Aria pick the difficulty based on the student's recent accuracy.
    api.practice(topicId, 'AUTO', 5).then(setSet).catch((e) => setError((e as Error).message))
  }

  useEffect(load, [topicId])

  const question = set?.questions[index]
  const isLast = set ? index === set.questions.length - 1 : false

  const check = async () => {
    if (!question || !value.trim()) return
    setChecking(true)
    try {
      const r = await api.answer(question.questionId, value)
      setResult(r)
      if (r.correct) {
        const newScore = score + 1
        setScore(newScore)
        // Big finish if they nail the last one; otherwise a quick cheerful burst.
        if (isLast && newScore === (set?.questions.length ?? 0)) celebrateBig()
        else celebrateCorrect()
      }
      if (isLast) markStepDone(user?.id, topicId, 'practice') // finishing the set completes Practice
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setChecking(false)
    }
  }

  const next = () => {
    setIndex((i) => i + 1)
    setValue('')
    setResult(null)
  }

  return (
    <div className="app-shell student-theme">
      <header className="topbar">
        <div className="brand">🦉 Aria</div>
        <Link className="btn btn--ghost" to="/student"><ArrowLeft size={16} /> Back</Link>
      </header>

      <main className="container narrow">
        {!set && !error && (
          <FunLoader variant="practice" />
        )}
        {error && <div className="error">{error}</div>}

        {set && question && (
          <div className="card practice">
            <div className="progress">
              <div className="progress-bar" style={{ width: `${(index / set.questions.length) * 100}%` }} />
            </div>
            <div className="muted">Question {index + 1} of {set.questions.length} · {question.difficulty}</div>
            <h2 className="q-prompt">{question.prompt}</h2>

            <QuestionRenderer
              question={question}
              value={value}
              onChange={setValue}
              disabled={!!result}
              correctAnswer={result ? result.correctAnswer : null}
            />

            {!result && (
              <button className="btn btn--primary btn--block" disabled={checking || !value.trim()} onClick={check}>
                {checking ? 'Checking...' : 'Check answer'}
              </button>
            )}

            {result && (
              <div className={`feedback ${result.correct ? 'feedback--ok' : 'feedback--no'}`}>
                <div className={`feedback-head ${result.correct ? 'feedback-head--pop' : ''}`}>
                  {result.correct
                    ? <><CheckCircle2 size={22} /> Correct!</>
                    : <><HelpCircle size={22} /> Not quite</>}
                </div>
                {result.feedback && <p className="feedback-text">🦉 {result.feedback}</p>}
                {!result.correct && <div>One correct answer: <strong>{result.correctAnswer}</strong></div>}
                {result.solution && <p className="solution">{result.solution}</p>}
                <ReportQuestion questionId={question.questionId} />
                {!isLast && <button className="btn btn--accent btn--block" onClick={next}>Next question <ArrowRight size={16} /></button>}
                {isLast && (
                  <div className="done">
                    <h3>You scored {score} / {set.questions.length} <Star size={20} className="star-inline" /></h3>
                    <NextStepButton topicId={topicId!} current="practice" />
                    <button className="btn btn--ghost" onClick={load}><RotateCcw size={16} /> Practice again</button>
                    <Link className="btn btn--ghost" to="/student">Back to lessons</Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
