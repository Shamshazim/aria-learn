import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api, ExamplesView } from '../api'

export default function Examples() {
  const { topicId } = useParams()
  const [data, setData] = useState<ExamplesView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!topicId) return
    setData(null); setError(null)
    api.examples(topicId).then(setData).catch((e) => setError((e as Error).message))
  }, [topicId])

  return (
    <div className="app-shell student-theme">
      <header className="topbar">
        <div className="brand">🦉 Aria</div>
        <Link className="btn btn--ghost" to="/student"><ArrowLeft size={16} /> Back</Link>
      </header>

      <main className="container narrow">
        {!data && !error && (
          <div className="card thinking"><div className="spinner" /><p>Aria is working through examples...</p></div>
        )}
        {error && <div className="error">{error}</div>}

        {data && (
          <>
            <h1>{data.topicName} — Worked Examples</h1>
            {data.content.examples.map((ex, i) => (
              <article key={i} className="card example">
                <div className="example-problem">📝 {ex.problem}</div>
                <ol className="example-steps">
                  {ex.steps.map((s, j) => <li key={j}>{s}</li>)}
                </ol>
                <div className="example-answer">✅ Answer: <strong>{ex.answer}</strong></div>
              </article>
            ))}
            <Link className="btn btn--accent btn--block" to={`/student/topic/${topicId}/guided`}>
              Now try it with Aria's help →
            </Link>
          </>
        )}
      </main>
    </div>
  )
}
