export function Progress({
  current,
  total,
}: {
  current: number;
  total: number;
}): React.JSX.Element {
  return (
    <div
      className="session-progress"
      aria-label={`Question ${String(current + 1)} of ${String(total)}`}
      aria-valuemax={total}
      aria-valuemin={1}
      aria-valuenow={current + 1}
      role="progressbar"
    >
      {Array.from({ length: total }, (_, index) => (
        <span className={index <= current ? 'is-active' : ''} key={index} />
      ))}
    </div>
  );
}
