import { TutorMood } from '../lib/lessonBeats'

interface AriaTutorProps {
  mood?: TutorMood
  /** Drives the beak animation — true only while narration is actually playing. */
  speaking?: boolean
  size?: number
}

/**
 * Aria, drawn as an animated owl rather than the flat 🦉 emoji used elsewhere.
 *
 * Every moving part is a CSS animation on a class, so the whole character costs no
 * JS per frame: she bobs and blinks constantly, flaps her wings when cheering,
 * leans and extends a wing when pointing at a picture, and her beak opens and
 * closes only while speech is actually playing. All motion is disabled under
 * prefers-reduced-motion (see styles.css).
 */
export default function AriaTutor({ mood = 'idle', speaking = false, size = 150 }: AriaTutorProps) {
  return (
    <svg
      className={`aria-owl aria-owl--${mood} ${speaking ? 'is-speaking' : ''}`}
      width={size}
      height={size * (130 / 120)}
      viewBox="0 0 120 130"
      role="img"
      aria-label="Aria the owl tutor"
    >
      <g className="owl-body">
        {/* Ear tufts */}
        <path className="owl-tuft" d="M30 30 L26 8 L46 22 Z" />
        <path className="owl-tuft" d="M90 30 L94 8 L74 22 Z" />

        {/* Feet peeking out at the bottom */}
        <path className="owl-foot" d="M46 112 v9 M40 121 h12" />
        <path className="owl-foot" d="M74 112 v9 M68 121 h12" />

        {/* Wings — the right one is the pointer. They sit proud of the body (which spans
            17–103) so the flap and point animations are actually visible; tucked any
            further in, the body paints straight over them. */}
        <ellipse className="owl-wing owl-wing--l" cx="12" cy="76" rx="12" ry="25" />
        <ellipse className="owl-wing owl-wing--r" cx="108" cy="76" rx="12" ry="25" />

        {/* Head and body are one blobby shape, the way a cartoon owl reads best */}
        <ellipse className="owl-shell" cx="60" cy="68" rx="43" ry="47" />
        <ellipse className="owl-belly" cx="60" cy="84" rx="28" ry="30" />

        {/* Eyes */}
        <g className="owl-eyes">
          <circle className="owl-eye" cx="45" cy="58" r="16" />
          <circle className="owl-eye" cx="75" cy="58" r="16" />
          <circle className="owl-pupil" cx="45" cy="58" r="7.5" />
          <circle className="owl-pupil" cx="75" cy="58" r="7.5" />
          <circle className="owl-glint" cx="48" cy="54" r="2.6" />
          <circle className="owl-glint" cx="78" cy="54" r="2.6" />
          {/* Lids scale down over the eyes to blink */}
          <circle className="owl-lid" cx="45" cy="58" r="16.5" />
          <circle className="owl-lid" cx="75" cy="58" r="16.5" />
        </g>

        {/* Brows — only visible when she's thinking something over */}
        <path className="owl-brow owl-brow--l" d="M33 40 L57 46" />
        <path className="owl-brow owl-brow--r" d="M87 40 L63 46" />

        {/* Beak opens and closes while she talks */}
        <path className="owl-beak" d="M60 68 L52 78 L68 78 Z" />
      </g>
    </svg>
  )
}
