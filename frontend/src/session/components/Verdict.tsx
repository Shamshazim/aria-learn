import { Check, Lightbulb, X } from 'lucide-react'

/**
 * Aria's reaction, and the explanation when one is due.
 *
 * The explanation is deliberately not shown on the first miss. A child who is told the
 * answer the moment they are wrong learns to be wrong on purpose.
 */
export default function Verdict({ ok, say, teach }: { ok: boolean; say: string; teach: string | null }) {
  return (
    <>
      <div className={`sx-verdict ${ok ? 'sx-verdict--ok' : 'sx-verdict--no'}`}>
        {ok ? <Check size={22} /> : <X size={22} />}
        <span>{say}</span>
      </div>
      {teach && <div className="sx-hintline"><Lightbulb size={18} /> {teach}</div>}
    </>
  )
}

export function HintLine({ text }: { text: string }) {
  return <div className="sx-hintline"><Lightbulb size={18} /> {text}</div>
}

/** Shown while Aria is reading an answer. Silence for four seconds reads as a dead page. */
export function WaitLine({ text }: { text: string }) {
  return <div className="sx-hintline" aria-live="polite">{text}</div>
}
