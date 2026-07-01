import { Link } from 'react-router-dom'
import { ArrowRight, PartyPopper } from 'lucide-react'
import { StepKey, nextStep, stepPath } from '../lib/steps'

/** Moves the student straight to the next step in the topic flow. On the last step
 *  (the quiz) there is no next, so it returns them to their lessons. */
export default function NextStepButton({ topicId, current }: { topicId: string; current: StepKey }) {
  const next = nextStep(current)
  if (!next) {
    return (
      <Link className="btn btn--primary btn--block step-next" to="/student">
        <PartyPopper size={16} /> All done — back to lessons
      </Link>
    )
  }
  const Icon = next.icon
  return (
    <Link className="btn btn--primary btn--block step-next" to={stepPath(topicId, next)}>
      Next step: <Icon size={16} /> {next.label} <ArrowRight size={16} />
    </Link>
  )
}
