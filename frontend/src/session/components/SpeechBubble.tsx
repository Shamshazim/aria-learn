import { Volume2 } from 'lucide-react'
import AriaOwl from './AriaOwl'
import { Band } from '../band'

/**
 * What Aria is saying, with the button that reads it aloud.
 *
 * The speaker is not an accessibility extra here. In the early band the child cannot
 * read the sentence at all, so this button is the primary way the task is delivered.
 *
 * The owl beside the bubble changes with the band: the early layout already has her at
 * full size in her own column, the middle band gets a small one here to keep her in the
 * conversation, and the senior band gets an avatar the size of a chat portrait.
 */
export default function SpeechBubble({ text, band, speaking, mood, onSpeak }: {
  text: string
  band: Band
  speaking: boolean
  mood: 'idle' | 'cheer' | 'think'
  onSpeak: () => void
}) {
  return (
    <div className="sx-sayrow">
      {band === 'middle' && (
        <span className="sx-owl-inline"><AriaOwl size={78} mood={mood} speaking={speaking} /></span>
      )}
      {band === 'senior' && <AriaOwl size={40} avatar mood={mood} speaking={speaking} />}
      <div className="sx-say">{text}</div>
      <button className={`sx-speak ${speaking ? 'is-on' : ''}`} onClick={onSpeak}
              aria-label="Read this out loud">
        <Volume2 size={22} />
      </button>
    </div>
  )
}
