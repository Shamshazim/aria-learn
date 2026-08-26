/** "Are you still there?" — shown for the last two minutes of an idle session (P2H-12). */
export function IdleNotice(): React.JSX.Element {
  return (
    <p aria-live="polite" className="auth-page__problem" role="status">
      Still there? Tap anywhere to keep going.
    </p>
  );
}
