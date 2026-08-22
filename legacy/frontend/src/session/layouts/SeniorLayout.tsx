import { MessageCircle } from 'lucide-react'
import SpeechBubble from '../components/SpeechBubble'
import AnswerControl from '../components/AnswerControl'
import Verdict, { HintLine, WaitLine } from '../components/Verdict'
import { SegmentBar } from '../components/Progress'
import AskAria from '../components/AskAria'
import { Session } from '../useSession'

/**
 * Grades 6 to 8.
 *
 * This band gets a tool, not a playground: a bordered work card, a serif problem line, a
 * quiet segmented bar instead of dots. Aria is a 40px avatar in a threaded conversation.
 * Nothing about the teaching changes — only everything that would tell a thirteen-year-old
 * the app thinks they are small.
 */
export default function SeniorLayout({ s, onMic }: { s: Session; onMic: () => void }) {
  const st = s.state!.step
  const showFeedbackPane = !!s.verdict || !!s.hint || s.busy

  return (
    <div className="sx-stage">
      <div className="sx-main">
        <div className="sx-card">
          {st.prompt && (
            <div className="sx-pane"><div className="sx-problem">{st.prompt}</div></div>
          )}

          <div className="sx-pane sx-pane--flush">
            <SpeechBubble text={st.say} band="senior" speaking={s.speaking} mood={s.mood} onSpeak={s.sayStep} />
          </div>

          <AnswerControl s={s} />

          {/* Rendered only when there is something in it. An empty bordered pane reads as
              a part of the page that failed to load. */}
          {showFeedbackPane && (
            <div className="sx-pane">
                {s.busy && !s.verdict && <WaitLine text="Aria is reading your work…" />}
            {s.verdict && <Verdict ok={s.verdict.ok} say={s.verdict.say} teach={s.verdict.teach} />}
              {s.hint && !s.verdict?.teach && <HintLine text={s.hint} />}
              {s.canAdvance && (
                <button className="sx-btn sx-btn--check" style={{ marginTop: 12 }}
                        disabled={s.busy} onClick={() => void s.advance()}>
                  Next problem
                </button>
              )}
            </div>
          )}

          <div className="sx-pane">
            <SegmentBar index={s.state!.index} total={s.state!.total} done={!!s.verdict?.ok} />
            {/* On a narrow screen the conversation column is gone, so the one thing this
                design exists to protect — being able to ask — needs its own way in. */}
            <button className="sx-btn sx-btn--ghost sx-ask-mobile" style={{ marginTop: 8 }}
                    onClick={() => s.setChatOpen(true)}>
              <MessageCircle size={18} /> Ask Aria
            </button>
          </div>
        </div>
      </div>

      <div className="sx-side">
        <AskAria band="senior" turns={s.chat} onSend={(t) => void s.askAria(t)} onMic={onMic} />
      </div>
    </div>
  )
}
