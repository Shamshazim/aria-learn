import '@/features/session/styles/owl.css';

export type OwlMood = 'idle' | 'cheer' | 'think';

export function AriaOwl({
  avatar = false,
  mood = 'idle',
  size = 160,
  speaking = false,
}: {
  avatar?: boolean;
  mood?: OwlMood;
  size?: number;
  speaking?: boolean;
}): React.JSX.Element {
  const className = [
    'aria-owl',
    mood === 'idle' ? '' : `aria-owl--${mood}`,
    speaking ? 'is-speaking' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <svg
      aria-label="Aria the owl tutor"
      className={className}
      height={size}
      role="img"
      viewBox="0 0 200 200"
      width={size}
    >
      <g className="aria-owl__body">
        {avatar ? null : <OwlLimbs />}
        <path d="M62 62 54 20 94 46Z" fill="#5b4ad1" />
        <path d="m138 62 8-42-40 26Z" fill="#5b4ad1" />
        <ellipse cx="100" cy="106" fill="#6b57db" rx="62" ry="66" />
        <ellipse cx="100" cy="126" fill="#8c7be8" rx="41" ry="44" />
        <OwlEye cx={76} pupilX={79} shineX={84} />
        <OwlEye cx={124} pupilX={127} shineX={132} />
        <path
          className="aria-owl__brow"
          d="m56 64 40 12"
          fill="none"
          stroke="#3a2e8c"
          strokeLinecap="round"
          strokeWidth="6"
        />
        <path
          className="aria-owl__brow"
          d="m144 64-40 12"
          fill="none"
          stroke="#3a2e8c"
          strokeLinecap="round"
          strokeWidth="6"
        />
        <path className="aria-owl__beak" d="m100 106-12 16h24Z" fill="#f0a63c" />
      </g>
    </svg>
  );
}

function OwlLimbs(): React.JSX.Element {
  return (
    <>
      <path
        d="M78 168v10m-12 0h24"
        fill="none"
        stroke="#f0a63c"
        strokeLinecap="round"
        strokeWidth="7"
      />
      <path
        d="M122 168v10m-12 0h24"
        fill="none"
        stroke="#f0a63c"
        strokeLinecap="round"
        strokeWidth="7"
      />
      <ellipse className="aria-owl__wing-left" cx="40" cy="116" fill="#4c3bb5" rx="20" ry="40" />
      <ellipse className="aria-owl__wing-right" cx="160" cy="116" fill="#4c3bb5" rx="20" ry="40" />
    </>
  );
}

function OwlEye(props: { cx: number; pupilX: number; shineX: number }): React.JSX.Element {
  return (
    <>
      <circle cx={props.cx} cy="94" fill="#fff" r="26" />
      <circle cx={props.pupilX} cy="96" fill="#1e1a3c" r="12" />
      <circle cx={props.shineX} cy="90" fill="#fff" r="4" />
      <circle className="aria-owl__lid" cx={props.cx} cy="94" fill="#6b57db" r="27" />
    </>
  );
}
