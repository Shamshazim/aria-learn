import { Link } from 'react-router-dom';

export default function NotFoundPage(): React.JSX.Element {
  return (
    <main className="shell">
      <h1>This page is not here.</h1>
      <Link to="/">Go back home</Link>
    </main>
  );
}
