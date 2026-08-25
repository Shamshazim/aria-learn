import { Link } from 'react-router-dom';

import { AriaOwl } from '@/features/session/components/AriaOwl';

export function DoneCard(): React.JSX.Element {
  return (
    <section className="session-card session-done" aria-live="polite">
      <AriaOwl mood="cheer" size={150} />
      <h1>You did it.</h1>
      <p>You stayed with the problem and kept thinking.</p>
      <Link className="session-action" to="/choose">
        Pick another class
      </Link>
    </section>
  );
}
