import { Link } from 'react-router-dom'
import KidHeader from '../components/KidHeader'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { RESOURCES, ResourceSubject } from '../lib/resources'

const SUBJECT_ORDER: ResourceSubject[] = ['Math', 'English', 'General']

export default function Resources() {
  // Group resources by subject so the hub stays tidy as more are added.
  const bySubject = SUBJECT_ORDER
    .map((subject) => ({ subject, items: RESOURCES.filter((r) => r.subject === subject) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="app-shell student-theme">
      <KidHeader right={<Link className="btn btn--ghost" to="/student"><ArrowLeft size={16} /> Back</Link>} />

      <main className="container">
        <div className="greeting card card--hero">
          <h1>📚 Learning Resources</h1>
          <p>Handy tools to practise and remember what you're learning. Pick one to get started!</p>
        </div>

        {bySubject.map(({ subject, items }) => (
          <section key={subject}>
            <h2 className="unit-heading">{subject}</h2>
            <div className="resource-grid">
              {items.map((r) => (
                <Link key={r.id} to={r.to} className="card resource-card"
                      style={{ ['--resource-accent' as string]: `var(--${r.accent})` }}>
                  <div className="resource-emoji">{r.emoji}</div>
                  <div className="resource-body">
                    <h3>{r.title}</h3>
                    <p className="muted">{r.blurb}</p>
                  </div>
                  <span className="resource-open">Open →</span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <p className="hint"><Sparkles size={14} /> More resources are on the way!</p>
      </main>
    </div>
  )
}
