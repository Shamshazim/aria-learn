import { ReactNode } from 'react'
import { useAuth } from '../auth'

interface KidHeaderProps {
  /** Optional context label shown after the brand, e.g. "Quiz". */
  subtitle?: string
  /** Right-side actions (Back link, Sign out, Timer, …). */
  right?: ReactNode
}

/**
 * The playful, animated header shown on every student page. A decorative band of
 * floating shapes fills the width, with a big waving greeting in the middle.
 */
export default function KidHeader({ subtitle, right }: KidHeaderProps) {
  const { user } = useAuth()
  const firstName = (user?.displayName ?? '').split(' ')[0] || 'friend'

  return (
    <header className="topbar kid-header">
      {/* Decorative, non-interactive layer that fills the blank space. */}
      <div className="kid-header__shapes" aria-hidden="true">
        <span className="kh-blob kh-blob--a" />
        <span className="kh-blob kh-blob--b" />
        <span className="kh-blob kh-blob--c" />
        <span className="kh-shape kh-shape--1">⭐</span>
        <span className="kh-shape kh-shape--2">🌈</span>
        <span className="kh-shape kh-shape--3">✨</span>
        <span className="kh-shape kh-shape--4">🎈</span>
        <span className="kh-shape kh-shape--5">⚡</span>
        <span className="kh-shape kh-shape--6">🌟</span>
      </div>

      <div className="brand kid-header__brand">
        🦉 Aria{subtitle ? <span className="brand-sub"> · {subtitle}</span> : null}
      </div>

      <div className="kid-greet">
        <span className="kid-greet__wave" aria-hidden="true">👋</span>
        <span className="kid-greet__text">Hi, {firstName}!</span>
        <span className="kid-greet__star" aria-hidden="true">⭐</span>
      </div>

      <div className="topbar-right kid-header__right">{right}</div>
    </header>
  )
}
