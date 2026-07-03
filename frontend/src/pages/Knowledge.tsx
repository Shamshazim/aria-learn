import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api, KnowledgeContent, KnowledgeView } from '../api'
import MathVisual from '../components/MathVisual'
import ReadAloud from '../components/ReadAloud'
import NextStepButton from '../components/NextStepButton'
import FunLoader from '../components/FunLoader'
import { markStepDone } from '../lib/steps'
import { useAuth } from '../auth'

function Section({ title, items, emoji }: { title: string; items: string[]; emoji: string }) {
  if (!items?.length) return null
  return (
    <div className="know-section">
      <h3>{emoji} {title}</h3>
      <ul>{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
    </div>
  )
}

function fullText(c: KnowledgeContent) {
  return [c.explanation, ...(c.realWorldExamples ?? []), ...(c.tips ?? []), c.summary].filter(Boolean).join('. ')
}

/** Renders a lesson body (explanation + visuals + examples + mistakes + tips + summary). */
function LessonBody({ content }: { content: KnowledgeContent }) {
  return (
    <>
      <div className="explain-block">
        <p className="explanation">{content.explanation}</p>
        <ReadAloud text={content.explanation} label="Hear this" />
      </div>

      {content.visuals?.length > 0 && (
        <div className="know-section">
          <h3>🎨 Picture it</h3>
          <div className="visuals-grid">
            {content.visuals.map((v, i) => <MathVisual key={i} visual={v} />)}
          </div>
        </div>
      )}

      <Section title="Real-world examples" items={content.realWorldExamples} emoji="🌍" />
      <Section title="Watch out for" items={content.commonMistakes} emoji="⚠️" />
      <Section title="Aria's tips" items={content.tips} emoji="💡" />

      {content.summary && (
        <div className="summary">
          <strong>Recap:</strong> {content.summary} <ReadAloud text={content.summary} label="Hear recap" />
        </div>
      )}
    </>
  )
}

export default function Knowledge() {
  const { topicId } = useParams()
  const { user } = useAuth()
  const [data, setData] = useState<KnowledgeView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elab, setElab] = useState<KnowledgeContent | null>(null)
  const [elabBusy, setElabBusy] = useState(false)

  useEffect(() => {
    if (!topicId) return
    setData(null); setError(null); setElab(null)
    api.knowledge(topicId).then((d) => {
      setData(d)
      markStepDone(user?.id, topicId, 'learn') // reading the lesson completes the Learn step
    }).catch((e) => setError((e as Error).message))
  }, [topicId])

  const explainDifferently = async () => {
    if (!topicId) return
    setElabBusy(true)
    try {
      const v = await api.elaborate(topicId)
      setElab(v.content)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setElabBusy(false)
    }
  }

  const c = data?.content

  return (
    <div className="app-shell student-theme">
      <header className="topbar">
        <div className="brand">🦉 Aria</div>
        <Link className="btn btn--ghost" to="/student"><ArrowLeft size={16} /> Back</Link>
      </header>

      <main className="container narrow">
        {!data && !error && <FunLoader variant="lesson" />}
        {error && <div className="error">{error}</div>}

        {data && c && (
          <>
            <article className="card lesson">
              <div className="lesson-head">
                <h1>{data.topicName}</h1>
                <ReadAloud text={fullText(c)} label="Read the lesson" />
              </div>
              <LessonBody content={c} />
            </article>

            {/* Stuck? Ask Aria to re-teach it a different way. */}
            <div className="elaborate-zone">
              <button className="btn btn--block elaborate-btn" disabled={elabBusy} onClick={explainDifferently}>
                {elabBusy ? 'Aria is thinking of another way...' : (elab ? '🔁 Explain it another way' : '🤔 I still don’t get it — explain it differently')}
              </button>
            </div>

            {elabBusy && !elab && <FunLoader variant="lesson" />}

            {elab && (
              <article className="card lesson elaborate-card">
                <div className="lesson-head">
                  <h2>🌟 Another way to see it</h2>
                  <ReadAloud text={fullText(elab)} label="Read this" />
                </div>
                <LessonBody content={elab} />
              </article>
            )}

            <NextStepButton topicId={topicId!} current="learn" />
          </>
        )}
      </main>
    </div>
  )
}
