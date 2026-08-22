import { RotateCcw } from 'lucide-react'
import AriaOwl from './AriaOwl'
import { Band } from '../band'

/**
 * The end of a sitting.
 *
 * It says what happened and stops. No score to beat, no "next lesson" button — a child
 * who has finished should be allowed to have finished, and what comes next is a decision
 * for Aria and the parent, not a button on this card.
 */
export default function DoneCard({ band, stars, total, focus, onRestart }: {
  band: Band
  stars: number
  total: number
  focus: string
  onRestart: () => void
}) {
  const early = band === 'early'

  return (
    <div className="sx-card sx-done">
      <AriaOwl size={early ? 190 : 120} mood="cheer" />
      <h2>{early ? 'All done! 🎉' : 'Session complete'}</h2>
      <p>
        {early
          ? `You got ${stars} of ${total} right. Come back tomorrow and we will count some more.`
          : `You worked through ${total} problems on ${focus.toLowerCase()} and got ${stars} right. Next time I will bring something a little harder.`}
      </p>
      <button className="sx-btn sx-btn--check" onClick={onRestart}>
        <RotateCcw size={18} /> Start again
      </button>
    </div>
  )
}
