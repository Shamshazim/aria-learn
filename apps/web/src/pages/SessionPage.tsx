import { Navigate, useParams } from 'react-router-dom';

import { bandForGrade, parseGrade } from '@aria/shared';

import {
  EarlyLayout,
  MiddleLayout,
  mockSession,
  SeniorLayout,
  useMockSession,
} from '@/features/session';
import { SessionTopbar } from '@/features/session/components/SessionTopbar';
import '@/features/session/styles/session.css';

export default function SessionPage(): React.JSX.Element {
  const params = useParams();
  const grade = parseGrade(params.grade ?? '');
  if (grade === null) return <Navigate replace to="/choose" />;
  return <SessionForGrade grade={grade} subject={params.subject ?? 'class'} />;
}

function SessionForGrade(props: {
  grade: NonNullable<ReturnType<typeof parseGrade>>;
  subject: string;
}): React.JSX.Element {
  const band = bandForGrade(props.grade);
  const session = mockSession(band, props.subject);
  const view = useMockSession(session);
  return (
    <div className="session-app" data-band={band}>
      <SessionTopbar subject={props.subject} />
      {band === 'early' ? (
        <EarlyLayout session={session} view={view} />
      ) : band === 'middle' ? (
        <MiddleLayout session={session} view={view} />
      ) : (
        <SeniorLayout session={session} view={view} />
      )}
    </div>
  );
}
