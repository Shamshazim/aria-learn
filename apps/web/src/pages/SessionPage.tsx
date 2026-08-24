import { useCallback } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';

import { bandForGrade, parseGrade } from '@aria/shared';

import {
  EarlyLayout,
  MiddleLayout,
  SeniorLayout,
  ConnectionNotice,
  SessionTopbar,
  createScriptedSource,
  createUnavailableOnceSource,
  scenarioEvents,
  useTutorSession,
} from '@/features/session';
import '@/features/session/styles/session.css';
import '@/features/session/styles/session-feedback.css';

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
  const [searchParams] = useSearchParams();
  const startupEvents = scenarioEvents(searchParams.get('scenario'));
  const failure = searchParams.get('failure');
  const createSource = useCallback(
    failure === 'content' ? createUnavailableOnceSource : createScriptedSource,
    [failure],
  );
  const session = useTutorSession({
    band,
    createSource,
    grade: props.grade,
    subjectId: props.subject,
    ...(startupEvents === undefined ? {} : { startupEvents }),
  });
  return (
    <div className="session-app" data-band={band}>
      <SessionTopbar subject={props.subject} />
      <ConnectionNotice band={band} status={session.connectionStatus} />
      <main>
        <h1 className="visually-hidden">{props.subject} learning session</h1>
        {band === 'early' ? (
          <EarlyLayout session={session} />
        ) : band === 'middle' ? (
          <MiddleLayout session={session} />
        ) : (
          <SeniorLayout session={session} />
        )}
      </main>
    </div>
  );
}
