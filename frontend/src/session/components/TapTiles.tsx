/**
 * The early band's answer control: a row of very large coloured tiles.
 *
 * A tap is the answer. There is no separate confirm button, because a five-year-old
 * reads a second step as "my tap did not work" and taps again. The colours carry no
 * meaning — they exist only to make each tile a distinct target for a child who cannot
 * yet read. Once an answer is graded every untouched tile goes grey, so the green
 * "correct" state can never be confused with the tile that is green by position.
 */
const TINT = ['sx-tile--t0', 'sx-tile--t1', 'sx-tile--t2', 'sx-tile--t3']

export default function TapTiles({ choices, chosen, graded, correct, disabled, onPick }: {
  choices: string[]
  chosen: string | null
  graded: boolean
  correct: boolean
  disabled: boolean
  onPick: (v: string) => void
}) {
  // Word-length faces need a readable face; single digits and letters get the big one.
  const long = choices.some((c) => c.length > 2)

  return (
    <div className="sx-tiles">
      {choices.map((c, i) => {
        const isChosen = chosen === c
        const cls = ['sx-tile', TINT[i % TINT.length], long ? 'sx-tile--long' : '']
        if (isChosen) cls.push('is-chosen')
        if (graded) cls.push(isChosen ? (correct ? 'is-right' : 'is-wrong') : 'is-muted')
        return (
          <button key={c} className={cls.filter(Boolean).join(' ')} disabled={disabled}
                  onClick={() => onPick(c)}>
            {c}
          </button>
        )
      })}
    </div>
  )
}
