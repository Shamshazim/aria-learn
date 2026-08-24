import type { Band, TutorMove } from '@aria/shared';

export function SessionProgress(props: {
  band: Band;
  moves: readonly TutorMove[];
}): React.JSX.Element {
  const completed = props.moves.some((move) => move.kind === 'PRAISE') ? 1 : 0;
  if (props.band === 'senior') {
    return (
      <div
        aria-label={`${String(completed)} of 3 activities complete`}
        className="session-segments"
        role="img"
      >
        <span className={completed > 0 ? 'is-complete' : ''} />
        <span />
        <span />
        <small>{completed} of 3 in this session</small>
      </div>
    );
  }
  return (
    <div
      aria-label={`${String(completed)} of 3 activities complete`}
      className="session-dots"
      role="img"
    >
      <span className={completed > 0 ? 'is-complete' : ''} />
      <span />
      <span />
    </div>
  );
}
