import { useState } from 'react'
import { Flag } from 'lucide-react'
import { api } from '../api'

/** A small, kid-friendly "report this question" button. One click flags the question
 *  for a grown-up to review — used wherever a graded question is shown. */
export default function ReportQuestion({ questionId }: { questionId: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')

  const report = async () => {
    if (state !== 'idle') return
    setState('busy')
    try {
      await api.flagQuestion(questionId)
      setState('done')
    } catch {
      setState('idle')
    }
  }

  if (state === 'done') {
    return <div className="report-q report-q--done"><Flag size={13} /> Reported — a grown-up will check it. Thanks!</div>
  }
  return (
    <button type="button" className="report-q" disabled={state === 'busy'} onClick={report}>
      <Flag size={13} /> {state === 'busy' ? 'Reporting…' : 'Something look wrong? Report it'}
    </button>
  )
}
