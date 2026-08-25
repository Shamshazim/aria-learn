const STAR_POSITIONS = [
  [26, 86],
  [46, 92],
  [36, 70],
  [54, 74],
  [22, 64],
  [44, 54],
] as const;

export function StarJar({ count }: { count: number }): React.JSX.Element {
  return (
    <div className="star-jar">
      <svg
        aria-label={`${String(count)} stars earned`}
        height="104"
        role="img"
        viewBox="0 0 76 104"
        width="76"
      >
        <rect fill="#7c5ce0" height="13" rx="5" width="52" x="12" y="4" />
        <path
          d="M16 17h44v72a11 11 0 0 1-11 11H27a11 11 0 0 1-11-11Z"
          fill="#fff"
          stroke="#b7abe6"
          strokeWidth="2.5"
        />
        {STAR_POSITIONS.slice(0, Math.min(count, STAR_POSITIONS.length)).map(([x, y]) => (
          <path
            d="m50 8 12 30 33 2-26 20 9 32-28-18-28 18 9-32L5 40l33-2Z"
            fill="#f5b833"
            key={`${String(x)}-${String(y)}`}
            transform={`translate(${String(x - 9)},${String(y - 9)}) scale(.19)`}
          />
        ))}
      </svg>
      <span>{count}</span>
    </div>
  );
}
