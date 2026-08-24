import { Link } from 'react-router-dom';

export function SessionTopbar({ subject }: { subject: string }): React.JSX.Element {
  return (
    <header className="session-topbar">
      <Link to="/choose">Aria Learn</Link>
      <span>{subject}</span>
    </header>
  );
}
