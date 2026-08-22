/**
 * The senior band's answer control: numbered working rows and a final answer.
 *
 * At this level the method is the thing being taught, so the page asks for it. Only the
 * final answer is graded — the rows exist so the child works down the page instead of
 * guessing, and so Aria has something to read when they say they are stuck.
 *
 * A blank row is always kept at the bottom, so there is never a button to press before
 * writing the next line.
 */
export default function WorkPad({ prefill, rows, final, disabled, onRows, onFinal, onCheck, onStuck }: {
  prefill: string[]
  rows: string[]
  final: string
  disabled: boolean
  onRows: (rows: string[]) => void
  onFinal: (v: string) => void
  onCheck: () => void
  onStuck: () => void
}) {
  const all = [...prefill, ...rows, '']

  const edit = (i: number, v: string) => {
    const k = i - prefill.length
    if (k < 0) return // a prefilled line is Aria's, not the child's
    const nextRows = [...rows]
    while (nextRows.length <= k) nextRows.push('')
    nextRows[k] = v
    onRows(nextRows)
  }

  return (
    <>
      <div className="sx-panehead"><h3>Your work</h3></div>

      <div className="sx-rows">
        {all.map((r, i) => (
          <div className={`sx-row ${i < prefill.length ? 'sx-row--locked' : ''}`} key={i}>
            <span className="sx-n">{i + 1}</span>
            <input
              value={r}
              readOnly={i < prefill.length}
              disabled={disabled}
              placeholder={i === all.length - 1 ? 'next step…' : ''}
              onChange={(e) => edit(i, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="sx-final">
        <label htmlFor="sx-final-answer">Final answer</label>
        <input id="sx-final-answer" value={final} disabled={disabled} placeholder="x = ?"
               onChange={(e) => onFinal(e.target.value)}
               onKeyDown={(e) => { if (e.key === 'Enter') onCheck() }} />
      </div>

      <div className="sx-actions">
        <button className="sx-btn sx-btn--check" disabled={disabled || !final.trim()} onClick={onCheck}>
          Check my work
        </button>
        <button className="sx-btn sx-btn--ghost" onClick={onStuck}>I&apos;m stuck</button>
      </div>
    </>
  )
}
