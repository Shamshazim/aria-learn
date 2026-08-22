/**
 * The reading band's answer control: word cards.
 *
 * Same rule as the tiles — the tap is the answer, with no confirm step. These stay
 * left-aligned and set in the body face because the options are phrases to be read, not
 * targets to be hit.
 */
export default function ChoiceCards({ choices, chosen, graded, correct, disabled, onPick }: {
  choices: string[]
  chosen: string | null
  graded: boolean
  correct: boolean
  disabled: boolean
  onPick: (v: string) => void
}) {
  return (
    <div className="sx-choices">
      {choices.map((c) => {
        const isChosen = chosen === c
        const cls = ['sx-choice']
        if (isChosen) cls.push('is-chosen')
        if (graded && isChosen) cls.push(correct ? 'is-right' : 'is-wrong')
        return (
          <button key={c} className={cls.join(' ')} disabled={disabled} onClick={() => onPick(c)}>
            {c}
          </button>
        )
      })}
    </div>
  )
}
