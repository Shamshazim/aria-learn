import { StepVisual } from '../types'

/**
 * The picture that carries the question.
 *
 * For the early band this IS the question — the child counts what is drawn here and
 * never reads the sentence. So the items are large, evenly spaced and flat, with no
 * decoration that could be mistaken for another countable thing.
 */

const apple = (s: number) => (
  <svg width={s} height={s} viewBox="0 0 100 100" aria-hidden="true">
    <path d="M50 22c-4-10-12-14-18-14 2 8 8 13 15 15z" fill="#4CAF50" />
    <rect x="47" y="12" width="6" height="18" rx="3" fill="#8D5524" />
    <path d="M50 28c18-12 40 2 40 26 0 22-18 42-40 42s-40-20-40-42c0-24 22-38 40-26z" fill="#E23B3B" />
    <ellipse cx="34" cy="50" rx="7" ry="10" fill="#F06060" />
  </svg>
)

const star = (s: number) => (
  <svg width={s} height={s} viewBox="0 0 100 100" aria-hidden="true">
    <path d="M50 8 62 38 95 40 69 60 78 92 50 74 22 92 31 60 5 40 38 38Z" fill="#F5B833" />
  </svg>
)

const block = (s: number) => (
  <svg width={s} height={s} viewBox="0 0 100 100" aria-hidden="true">
    <rect x="14" y="14" width="72" height="72" rx="14" fill="#4A90D9" />
    <rect x="30" y="30" width="16" height="16" rx="5" fill="#7FB6ED" />
    <rect x="54" y="54" width="16" height="16" rx="5" fill="#7FB6ED" />
  </svg>
)

const ART = { apple, star, block }

export default function StepVisualView({ visual, large }: { visual: StepVisual; large: boolean }) {
  if (visual.kind === 'items') {
    const draw = ART[visual.item]
    const size = large ? 118 : 62
    return (
      <div className="sx-items">
        {Array.from({ length: visual.count }, (_, i) => <span key={i}>{draw(size)}</span>)}
      </div>
    )
  }

  // Equal groups, drawn as outlined trays. A filled tray competes with the dots the
  // child is meant to count.
  return (
    <div className="sx-groups">
      {Array.from({ length: visual.groups }, (_, g) => (
        <div className="sx-tray" key={g}>
          {Array.from({ length: visual.per }, (_, i) => <span key={i} />)}
        </div>
      ))}
    </div>
  )
}
