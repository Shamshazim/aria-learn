import { ArrowRight, Mic, MessageCircle } from 'lucide-react'
import AriaOwl from '../components/AriaOwl'
import SpeechBubble from '../components/SpeechBubble'
import StepVisualView from '../components/StepVisualView'
import AnswerControl from '../components/AnswerControl'
import Verdict, { HintLine, WaitLine } from '../components/Verdict'
import { ProgressDots } from '../components/Progress'
import StarJar from '../components/StarJar'
import { Session } from '../useSession'

/**
 * TK to grade 2.
 *
 * Aria is a character standing in the room, not an avatar. The instruction is spoken;
 * the picture is the question; the answer is one tap on something enormous. There is one
 * blue button on the screen and it always means the same thing, so a child who cannot
 * read still knows what to do next.
 */
export default function EarlyLayout({ s, onMic }: { s: Session; onMic: () => void }) {
  const st = s.state!.step

  return (
    <div className="sx-stage">
      <div className="sx-owlcol">
        <AriaOwl size={300} mood={s.mood} speaking={s.speaking} />
      </div>

      <div className="sx-main">
        <div className="sx-card">
          <SpeechBubble text={st.say} band="early" speaking={s.speaking} mood={s.mood} onSpeak={s.sayStep} />
          {st.visual && <StepVisualView visual={st.visual} large />}
          {s.hint && <HintLine text={s.hint} />}
        </div>

        <ProgressDots index={s.state!.index} total={s.state!.total} done={!!s.verdict?.ok} />

        <AnswerControl s={s} />

        {s.busy && !s.verdict && <WaitLine text="Aria is reading your answer…" />}

        {s.verdict && <Verdict ok={s.verdict.ok} say={s.verdict.say} teach={s.verdict.teach} />}

        <div className="sx-bottom">
          <button className="sx-mic" onClick={onMic} aria-label="Say your answer"><Mic size={26} /></button>
          <button className="sx-btn sx-btn--go" disabled={!s.canAdvance || s.busy}
                  onClick={() => void s.advance()}>
            Go <ArrowRight size={28} />
          </button>
          <button className="sx-askpill" onClick={() => s.setChatOpen(true)}>
            <MessageCircle size={20} /> Ask Aria
          </button>
        </div>
      </div>

      <div className="sx-jarcol"><StarJar count={s.stars} /></div>
    </div>
  )
}
