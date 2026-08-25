import { useCallback } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';

import { bandForGrade, parseGrade } from '@aria/shared';

import { createApiClient } from '@/api';
import { webConfig } from '@/app/config';
import {
  EarlyLayout,
  MiddleLayout,
  SeniorLayout,
  ConnectionNotice,
  SessionTopbar,
  createScriptedSource,
  createHttpTutorSource,
  createSessionApi,
  createUnavailableOnceSource,
  scenarioEvents,
  useTutorSession,
} from '@/features/session';
import '@/features/session/styles/session.css';
import '@/features/session/styles/session-chat.css';
import '@/features/session/styles/session-chrome.css';
import '@/features/session/styles/session-controls.css';
import '@/features/session/styles/session-feedback.css';

const sessionApi = createSessionApi(createApiClient({ baseUrl: webConfig.apiBaseUrl }));

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
  const scenario = searchParams.get('scenario');
  const arrivalId = searchParams.get('arrivalId') ?? undefined;
  const checkIn = searchParams.get('checkIn') ?? undefined;
  const fromRecommendation = searchParams.get('recommended') === '1';
  const createSource = useCallback(() => {
    if (failure === 'content') return createUnavailableOnceSource();
    if (scenario !== null) return createScriptedSource();
    return createHttpTutorSource({
      api: sessionApi,
      grade: props.grade,
      subject: props.subject,
      fromRecommendation,
      ...(arrivalId === undefined ? {} : { arrivalId }),
      ...(checkIn === undefined ? {} : { checkIn }),
    });
  }, [arrivalId, checkIn, failure, fromRecommendation, props.grade, props.subject, scenario]);
  const session = useTutorSession({
    band,
    createSource,
    grade: props.grade,
    subjectId: props.subject,
    ...(startupEvents === undefined ? {} : { startupEvents }),
  });
  return (
    <div className="session-app" data-band={band}>
      <SessionTopbar band={band} subject={props.subject} />
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
