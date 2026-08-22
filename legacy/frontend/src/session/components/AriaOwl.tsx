/**
 * Aria, drawn flat so one file survives every size the three bands ask of her.
 *
 * The early band shows her at 300px as a character standing in the room; the senior band
 * shows the same drawing at 40px as a chat avatar. Flat shapes and no feather detail is
 * what makes that work — a shaded illustration turns to mud below about 60px.
 *
 * All motion lives in CSS classes, so an idle owl costs nothing per frame and every
 * animation stops under prefers-reduced-motion.
 */
export type OwlMood = 'idle' | 'cheer' | 'think'

interface Props {
  mood?: OwlMood
  /** True only while narration is actually playing. It drives the beak. */
  speaking?: boolean
  size?: number
  /** Drops the wings and feet, for the small round chat avatar. */
  avatar?: boolean
}

export default function AriaOwl({ mood = 'idle', speaking = false, size = 160, avatar = false }: Props) {
  const cls = ['sx-owl', mood !== 'idle' ? `sx-owl--${mood}` : '', speaking ? 'is-speaking' : '']
    .filter(Boolean).join(' ')

  return (
    <svg className={cls} width={size} height={size} viewBox="0 0 200 200"
         role="img" aria-label="Aria the owl tutor">
      <g className="sx-owl-body">
        {!avatar && (
          <>
            <path d="M78 168 v10 M66 178 h24" stroke="#F0A63C" strokeWidth="7" strokeLinecap="round" fill="none" />
            <path d="M122 168 v10 M110 178 h24" stroke="#F0A63C" strokeWidth="7" strokeLinecap="round" fill="none" />
            {/* The wings sit outside the body outline on purpose. Drawn any closer to the
                centre they are hidden by the shell and the cheer animation looks broken. */}
            <ellipse className="sx-wing-l" cx="40" cy="116" rx="20" ry="40" fill="#4C3BB5" />
            <ellipse className="sx-wing-r" cx="160" cy="116" rx="20" ry="40" fill="#4C3BB5" />
          </>
        )}

        {/* Ear tufts read as "owl" faster than any other cue, so they stay on the avatar. */}
        <path d="M62 62 L54 20 L94 46 Z" fill="#5B4AD1" />
        <path d="M138 62 L146 20 L106 46 Z" fill="#5B4AD1" />

        {/* Head and body are one shape. A separate head reads as a mascot costume. */}
        <ellipse cx="100" cy="106" rx="62" ry="66" fill="#6B57DB" />
        <ellipse cx="100" cy="126" rx="41" ry="44" fill="#8C7BE8" />

        <circle cx="76" cy="94" r="26" fill="#fff" />
        <circle cx="124" cy="94" r="26" fill="#fff" />
        <circle cx="79" cy="96" r="12" fill="#1E1A3C" />
        <circle cx="127" cy="96" r="12" fill="#1E1A3C" />
        <circle cx="84" cy="90" r="4" fill="#fff" />
        <circle cx="132" cy="90" r="4" fill="#fff" />
        {/* The lids scale over the eyes to blink. */}
        <circle className="sx-lid" cx="76" cy="94" r="27" fill="#6B57DB" />
        <circle className="sx-lid" cx="124" cy="94" r="27" fill="#6B57DB" />

        {/* Brows appear only while she is thinking something over. */}
        <path className="sx-brow" d="M56 64 L96 76" stroke="#3A2E8C" strokeWidth="6" strokeLinecap="round" />
        <path className="sx-brow" d="M144 64 L104 76" stroke="#3A2E8C" strokeWidth="6" strokeLinecap="round" />

        <path className="sx-beak" d="M100 106 L88 122 L112 122 Z" fill="#F0A63C" />
      </g>
    </svg>
  )
}
