import { ReactNode } from 'react'
import { Band } from '../band'
import { AnswerKind } from '../types'
import { Session } from '../useSession'
import TapTiles from './TapTiles'
import ChoiceCards from './ChoiceCards'
import NumberPad from './NumberPad'
import WorkPad from './WorkPad'
import LongAnswer from './LongAnswer'

/**
 * Puts exactly one answer control on the screen.
 *
 * Which one is chosen by the band and the question, never by the child. Two controls at
 * once — a keyboard and a set of buttons, say — is the single fastest way to make a
 * young child stop and ask an adult what to do.
 */
/**
 * Gives the control the container its band expects.
 *
 * The senior band's controls live inside the bordered work card, divided by rules. The
 * younger bands' controls sit straight on the page — a tile or a number pad reads as a
 * physical thing to hit, and boxing it takes that away. Written answers are the
 * exception: a bare textarea on the page ground has no edge to write inside.
 */
function wrap(band: Band, kind: AnswerKind, node: ReactNode): ReactNode {
  if (band === 'senior') return <div className="sx-pane">{node}</div>
  if (kind === 'work' || kind === 'text') return <div className="sx-card">{node}</div>
  return node
}

export default function AnswerControl({ s }: { s: Session }) {
  const { state, input, setInput, locked, busy, graded, verdict } = s
  if (!state) return null

  const step = state.step
  const disabled = locked || busy
  const box = (node: ReactNode) => <>{wrap(state.band, step.answer, node)}</>

  switch (step.answer) {
    case 'tiles':
      return box(
        <TapTiles
          choices={step.choices ?? []}
          chosen={input.chosen}
          graded={graded}
          correct={!!verdict?.ok}
          disabled={disabled}
          onPick={s.pick}
        />
      )

    case 'choices':
      return box(
        <ChoiceCards
          choices={step.choices ?? []}
          chosen={input.chosen}
          graded={graded}
          correct={!!verdict?.ok}
          disabled={disabled}
          onPick={s.pick}
        />
      )

    case 'numpad':
      return box(
        <NumberPad
          value={input.value}
          disabled={disabled}
          onChange={(v) => setInput((i) => ({ ...i, value: v }))}
          onSubmit={() => void s.submit()}
        />
      )

    case 'work':
      return box(
        <WorkPad
          prefill={step.prefill ?? []}
          rows={input.rows}
          final={input.final}
          disabled={disabled}
          onRows={(rows) => setInput((i) => ({ ...i, rows }))}
          onFinal={(v) => setInput((i) => ({ ...i, final: v }))}
          onCheck={() => void s.submit()}
          onStuck={() => void s.askForHint()}
        />
      )

    default:
      return box(
        <LongAnswer
          value={input.text}
          disabled={disabled}
          onChange={(v) => setInput((i) => ({ ...i, text: v }))}
          onSend={() => void s.submit()}
          onStuck={() => void s.askForHint()}
        />
      )
  }
}
