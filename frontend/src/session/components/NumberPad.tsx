import { CornerDownLeft, Delete } from 'lucide-react'

/**
 * The middle band's answer control.
 *
 * A keyboard is the wrong instrument for a numeric answer at this age: it invites typos
 * that the grader reads as wrong thinking, and on a tablet it covers the problem. A pad
 * can only produce digits, so a wrong answer here is always a wrong answer.
 */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export default function NumberPad({ value, disabled, onChange, onSubmit }: {
  value: string
  disabled: boolean
  onChange: (v: string) => void
  onSubmit: () => void
}) {
  const push = (d: string) => { if (value.length < 6) onChange(value + d) }

  return (
    <div className="sx-padwrap">
      <div className="sx-padvalue" aria-live="polite">
        {value || <span className="sx-ph">—</span>}
        <span className="sx-caret" />
      </div>
      <div className="sx-pad">
        {KEYS.map((k) => (
          <button key={k} className="sx-key" disabled={disabled} onClick={() => push(k)}>{k}</button>
        ))}
        <button className="sx-key" disabled={disabled} aria-label="Delete"
                onClick={() => onChange(value.slice(0, -1))}>
          <Delete size={20} />
        </button>
        <button className="sx-key" disabled={disabled} onClick={() => push('0')}>0</button>
        <button className="sx-key sx-key--enter" disabled={disabled || !value} aria-label="Check"
                onClick={onSubmit}>
          <CornerDownLeft size={20} />
        </button>
      </div>
    </div>
  )
}
