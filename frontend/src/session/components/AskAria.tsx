import { useEffect, useRef, useState } from 'react'
import { Mic, Send, X } from 'lucide-react'
import AriaOwl from './AriaOwl'
import { Band } from '../band'
import { ChatTurn } from '../types'

/**
 * The child's way of talking to Aria mid-task.
 *
 * This is the part of the screen the whole design exists to protect: a child who is
 * stuck must be able to say so in their own words and get an answer, without leaving
 * the question or finding a help page. It is docked beside the work for readers, and
 * opened as a full overlay for the early band — a permanent panel there is one more
 * thing on screen for a child who cannot read the rest of it yet.
 */
export default function AskAria({ band, turns, onSend, onClose, onMic }: {
  band: Band
  turns: ChatTurn[]
  onSend: (text: string) => void
  onClose?: () => void
  onMic: () => void
}) {
  const [draft, setDraft] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns])

  const send = () => {
    if (!draft.trim()) return
    onSend(draft)
    setDraft('')
  }

  return (
    <div className="sx-chat">
      <div className="sx-chat-head">
        <span>{band === 'senior' ? 'Aria' : 'Ask Aria'}</span>
        {onClose && (
          <button className="sx-iconbtn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        )}
      </div>

      <div className="sx-chat-body" ref={bodyRef}>
        {turns.map((t, i) => (
          <div key={i} className={`sx-turn ${t.from === 'child' ? 'sx-turn--child' : ''}`}>
            {t.from === 'aria'
              ? <AriaOwl size={32} avatar />
              : <span className="sx-avatar" style={{ width: 32, height: 32, fontSize: 17 }}>🙂</span>}
            <div>
              <div className="sx-bub">{t.text}</div>
              {band === 'senior' && <div className="sx-stamp">{t.at}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="sx-chat-input">
        <input
          value={draft}
          placeholder={band === 'senior' ? 'Ask Aria anything' : 'Ask me anything'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
          aria-label="Ask Aria a question"
        />
        <button className="sx-iconbtn" onClick={onMic} aria-label="Speak your question"><Mic size={20} /></button>
        <button className="sx-iconbtn" onClick={send} aria-label="Send"><Send size={20} /></button>
      </div>
    </div>
  )
}
