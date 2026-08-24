export function AriaOwl({ large = false }: { large?: boolean }): React.JSX.Element {
  return (
    <div className={large ? 'session-owl session-owl--large' : 'session-owl'} aria-hidden="true">
      🦉
    </div>
  );
}
