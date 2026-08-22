import { useEffect, useState } from 'react'

/** A playful "Aria is thinking" loader for kids: a bouncing owl, floating shapes,
 *  and rotating fun facts + encouragement so the wait for the AI feels fun, not slow. */

type Variant = 'quiz' | 'practice' | 'lesson' | 'examples' | 'homework' | 'review' | 'default'

const TITLES: Record<Variant, string> = {
  quiz: 'Building your quiz…',
  practice: 'Writing your questions…',
  lesson: 'Preparing your lesson…',
  examples: 'Working through examples…',
  homework: 'Getting your homework ready…',
  review: 'Reviewing your work…',
  default: 'Aria is working…',
}

// A mix of "what Aria is doing", encouragement, and real fun facts. They rotate so the
// wait feels lively. Keep them short, cheerful, and kid-appropriate.
const MESSAGES = [
  '🦉 Aria is thinking really hard for you…',
  '✨ Sprinkling in a little challenge…',
  '💡 Did you know? A group of owls is called a “parliament”.',
  '🐙 Fun fact: an octopus has three hearts!',
  '🍯 Honey never spoils — ever.',
  '🔢 Zero was first used as a number in ancient India.',
  '🌈 A rainbow is actually a full circle!',
  '🚀 You could fit about one million Earths inside the Sun.',
  '🐝 Bees can recognize human faces.',
  '🧠 Your brain makes enough electricity to power a small light.',
  '⭐ You’re doing great — keep it up!',
  '🦕 Some dinosaurs were smaller than a chicken.',
  '🌍 A day on Venus is longer than its year.',
  '🍫 Chocolate was once used as money by the Aztecs.',
  '🐢 Some turtles can breathe through their tails.',
  '💧 Hot water can freeze faster than cold water sometimes.',
]

export default function FunLoader({ variant = 'default' }: { variant?: Variant }) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * MESSAGES.length))

  useEffect(() => {
    const id = window.setInterval(() => setIdx((i) => (i + 1) % MESSAGES.length), 2800)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="card fun-loader" role="status" aria-live="polite">
      <div className="fun-loader__stage">
        <span className="fun-loader__float fl-1">✏️</span>
        <span className="fun-loader__float fl-2">⭐</span>
        <span className="fun-loader__float fl-3">➕</span>
        <span className="fun-loader__float fl-4">✨</span>
        <span className="fun-loader__float fl-5">🔵</span>
        <div className="fun-loader__owl">🦉</div>
        <div className="fun-loader__shadow" />
      </div>

      <h2 className="fun-loader__title">{TITLES[variant]}</h2>
      <p className="fun-loader__msg" key={idx}>{MESSAGES[idx]}</p>

      <div className="fun-loader__dots"><span /><span /><span /></div>
    </div>
  )
}
