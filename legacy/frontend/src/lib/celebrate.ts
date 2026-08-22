import confetti from 'canvas-confetti'

const KID_COLORS = ['#4f46e5', '#f59e0b', '#16a34a', '#ec4899', '#06b6d4', '#a855f7']

/** A quick, cheerful burst — fired when a child gets a single question right. */
export function celebrateCorrect() {
  // Two side cannons angled toward the middle for a playful pop.
  confetti({
    particleCount: 60,
    spread: 70,
    startVelocity: 45,
    origin: { x: 0.15, y: 0.7 },
    angle: 60,
    colors: KID_COLORS,
    scalar: 0.9,
    disableForReducedMotion: true,
  })
  confetti({
    particleCount: 60,
    spread: 70,
    startVelocity: 45,
    origin: { x: 0.85, y: 0.7 },
    angle: 120,
    colors: KID_COLORS,
    scalar: 0.9,
    disableForReducedMotion: true,
  })
}

/** A bigger, longer celebration — fired when a child passes a quiz or finishes strong. */
export function celebrateBig() {
  const end = Date.now() + 1200
  const frame = () => {
    confetti({
      particleCount: 7,
      angle: 60,
      spread: 75,
      origin: { x: 0, y: 0.8 },
      colors: KID_COLORS,
      disableForReducedMotion: true,
    })
    confetti({
      particleCount: 7,
      angle: 120,
      spread: 75,
      origin: { x: 1, y: 0.8 },
      colors: KID_COLORS,
      disableForReducedMotion: true,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
  // A star-shaped burst from the top-center for the finish.
  confetti({
    particleCount: 120,
    spread: 100,
    startVelocity: 40,
    origin: { x: 0.5, y: 0.35 },
    colors: KID_COLORS,
    shapes: ['star', 'circle'],
    scalar: 1.1,
    disableForReducedMotion: true,
  })
}
