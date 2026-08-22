import { ArrowRight, Lightbulb, MessageCircle, Mic } from 'lucide-react'
import SpeechBubble from '../components/SpeechBubble'
import StepVisualView from '../components/StepVisualView'
import AnswerControl from '../components/AnswerControl'
import Verdict, { HintLine, WaitLine } from '../components/Verdict'
import { ProgressDots } from '../components/Progress'
import AskAria from '../components/AskAria'
import { Session } from '../useSession'

/**
 * Grades 3 to 5.
 *
 * The child can read now, so the problem is written as well as spoken and Aria shrinks
 * to a companion beside her own words. The conversation moves out of an overlay and
 * docks beside the work, where it stays visible while the child thinks — at this age
 * asking a question is a skill worth making obvious.
 */
export default function MiddleLayout({ s, onMic }: { s: Session; onMic: () => void }) {
  const st = s.state!.step
  const showHintButton = !s.locked && !s.hint && st.answer !== 'work' && st.answer !== 'text'

  return (
    <div className="sx-stage">
      <div className="sx-main">
        <div className="sx-card">
          <SpeechBubble text={st.say} band="middle" speaking={s.speaking} mood={s.mood} onSpeak={s.sayStep} />
          {st.visual && <StepVisualView visual={st.visual} large={false} />}
          {s.hint && <HintLine text={s.hint} />}
        </div>

        <AnswerControl s={s} />

        <ProgressDots index={s.state!.index} total={s.state!.total} done={!!s.verdict?.ok} />

        {showHintButton && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button className="sx-btn sx-btn--hint" onClick={() => void s.askForHint()}>
              <Lightbulb size={18} /> Need a hint?
            </button>
          </div>
        )}

        {s.busy && !s.verdict && <WaitLine text="Aria is reading your answer…" />}

        {s.verdict && <Verdict ok={s.verdict.ok} say={s.verdict.say} teach={s.verdict.teach} />}

        <div className="sx-bottom">
          {s.canAdvance ? (
            <button className="sx-btn sx-btn--next" disabled={s.busy} onClick={() => void s.advance()}>
              Next <ArrowRight size={22} />
            </button>
          ) : (
            <button className="sx-btn sx-btn--next" disabled={s.busy || s.locked}
                    onClick={() => void s.submit()}>
              Check <ArrowRight size={22} />
            </button>
          )}
          <button className="sx-mic" onClick={onMic} aria-label="Say your answer"><Mic size={22} /></button>
          <button className="sx-askpill sx-ask-mobile" onClick={() => s.setChatOpen(true)}>
            <MessageCircle size={20} /> Ask Aria
          </button>
        </div>
      </div>

      <div className="sx-side">
        <AskAria band="middle" turns={s.chat} onSend={(t) => void s.askAria(t)} onMic={onMic} />
      </div>
    </div>
  )
}
