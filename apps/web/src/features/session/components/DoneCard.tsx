import { Link } from 'react-router-dom';

export function DoneCard(): React.JSX.Element {
  return (
    <section className="session-card session-done" aria-live="polite">
      <p aria-hidden="true">✨</p>
      <h1>You did it.</h1>
      <p>You stayed with every question.</p>
      <Link className="session-action" to="/choose">
        Pick another class
      </Link>
    </section>
  );
}
