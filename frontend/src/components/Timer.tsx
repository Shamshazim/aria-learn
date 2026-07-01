import { useEffect, useRef, useState } from 'react'

// Counts down from `seconds`, fires onExpire once at zero.
export default function Timer({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds)
  const fired = useRef(false)

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id)
          if (!fired.current) {
            fired.current = true
            onExpire()
          }
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [onExpire])

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const low = remaining <= 30
  return <span className={`timer ${low ? 'timer--low' : ''}`}>⏱ {mm}:{ss}</span>
}
