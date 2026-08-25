export type SessionIconName =
  'back' | 'confused' | 'hand' | 'pause' | 'play' | 'send' | 'speaker' | 'thumb';

export function SessionIcon({
  name,
  size = 20,
}: {
  name: SessionIconName;
  size?: number;
}): React.JSX.Element {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      {iconPath(name)}
    </svg>
  );
}

function iconPath(name: SessionIconName): React.JSX.Element {
  const line = {
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
  } as const;
  switch (name) {
    case 'back':
      return <path {...line} d="m15 18-6-6 6-6" />;
    case 'confused':
      return (
        <path
          {...line}
          d="M9.1 9a3 3 0 1 1 5.4 1.8c-1.5 1-2.5 1.5-2.5 3.2m0 4h.01M12 3a9 9 0 1 0 9 9"
        />
      );
    case 'hand':
      return (
        <path
          {...line}
          d="M7 11V6a1.5 1.5 0 0 1 3 0v4-6a1.5 1.5 0 0 1 3 0v6-4a1.5 1.5 0 0 1 3 0v5-2a1.5 1.5 0 0 1 3 0v4c0 5-3 8-7 8s-7-3-7-7v-3a1.5 1.5 0 0 1 2-1.4"
        />
      );
    case 'pause':
      return <path {...line} d="M9 5v14m6-14v14" />;
    case 'play':
      return <path {...line} d="m8 5 11 7-11 7Z" />;
    case 'send':
      return <path {...line} d="m21 3-7 18-4-7-7-4Zm-11 11L21 3" />;
    case 'speaker':
      return <path {...line} d="M11 5 6 9H3v6h3l5 4Zm4 4a4 4 0 0 1 0 6m2.5-8.5a8 8 0 0 1 0 11" />;
    case 'thumb':
      return (
        <path
          {...line}
          d="M7 10v10H3V10Zm0 9h10a2 2 0 0 0 2-1.7l1-6A2 2 0 0 0 18 9h-4l1-4a2 2 0 0 0-4-1l-4 6Z"
        />
      );
    default:
      return assertNever(name);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled session icon: ${String(value)}`);
}
