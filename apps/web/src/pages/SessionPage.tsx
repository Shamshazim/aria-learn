import { useCallback } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { bandForGrade, parseGrade } from '@aria/shared';

import {
  EarlyLayout,
  MiddleLayout,
  SeniorLayout,
  createScriptedSource,
  useTutorSession,
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
  const createSource = useCallback(createScriptedSource, []);
  const session = useTutorSession({
    band,
    createSource,
    grade: props.grade,
    subjectId: props.subject,
  });
  return (
    <div className="session-app" data-band={band}>
      <SessionTopbar subject={props.subject} />
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
