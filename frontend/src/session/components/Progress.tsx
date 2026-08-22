/**
 * How far through the sitting the child is.
 *
 * Drawn as shapes, never as a percentage or a score. A number invites a child to compare
 * today with yesterday, which is the parent's job and not theirs.
 */
export function ProgressDots({ index, total, done }: { index: number; total: number; done: boolean }) {
  return (
    <div className="sx-dots">
      {Array.from({ length: total }, (_, k) => (
        <span key={k} className={`sx-dot ${k < index || (k === index && done) ? 'is-done' : ''}`} />
      ))}
    </div>
  )
}

export function SegmentBar({ index, total, done }: { index: number; total: number; done: boolean }) {
  const finished = index + (done ? 1 : 0)
  return (
    <div className="sx-bar">
      <div className="sx-segs">
        {Array.from({ length: total }, (_, k) => <i key={k} className={k < finished ? 'is-done' : ''} />)}
      </div>
      <span>{finished} of {total} in this session</span>
    </div>
  )
}
