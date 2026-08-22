/**
 * The early band's reward: stars dropping into a jar.
 *
 * It replaces the mastery percentage the old dashboard showed. A five-year-old cannot
 * read "62%", but they can see the jar filling, and they can see it is not full yet —
 * which is the only part of a score that is any use to them.
 */
const SPOTS: [number, number][] = [[26, 86], [46, 92], [36, 70], [54, 74], [22, 64], [44, 54], [30, 48], [52, 40]]

export default function StarJar({ count }: { count: number }) {
  return (
    <div className="sx-jar">
      <svg width="76" height="104" viewBox="0 0 76 104" role="img" aria-label={`${count} stars earned`}>
        <rect x="12" y="4" width="52" height="13" rx="5" fill="#7C5CE0" />
        <path d="M16 17 h44 v72 a11 11 0 0 1 -11 11 h-22 a11 11 0 0 1 -11 -11 z"
              fill="#FFFFFF" stroke="#B7ABE6" strokeWidth="2.5" />
        {SPOTS.slice(0, Math.min(count, SPOTS.length)).map(([x, y], i) => (
          <path key={i} transform={`translate(${x - 9},${y - 9}) scale(.19)`} fill="#F5B833"
                d="M50 8 L62 38 L95 40 L69 60 L78 92 L50 74 L22 92 L31 60 L5 40 L38 38 Z" />
        ))}
      </svg>
      <div className="sx-jar-count">{count}</div>
    </div>
  )
}
