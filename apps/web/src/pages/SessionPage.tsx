import { useCallback, useRef, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';

import { bandForGrade, parseGrade, type TutorMove } from '@aria/shared';

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
  useRealtimeVoice,
  VoiceControls,
} from '@/features/session';
import '@/features/session/styles/session.css';
import '@/features/session/styles/session-chat.css';
import '@/features/session/styles/session-chrome.css';
import '@/features/session/styles/session-controls.css';
import '@/features/session/styles/session-feedback.css';
import '@/features/voice/styles/voice.css';

const sessionApi = createSessionApi(createApiClient({ baseUrl: webConfig.apiBaseUrl }));

export default function SessionPage(): React.JSX.Element {
  const params = useParams();
  const grade = parseGrade(params.grade ?? '');
  if (grade === null) return <Navigate replace to="/choose" />;
  return <SessionForGrade grade={grade} subject={params.subject ?? 'class'} />;
}

type SessionProps = Readonly<{
  grade: NonNullable<ReturnType<typeof parseGrade>>;
  subject: string;
}>;

function SessionForGrade(props: SessionProps): React.JSX.Element {
  const band = bandForGrade(props.grade);
  const [searchParams] = useSearchParams();
  const startupEvents = scenarioEvents(searchParams.get('scenario'));
  const failure = searchParams.get('failure');
  const scenario = searchParams.get('scenario');
  const arrivalId = searchParams.get('arrivalId') ?? undefined;
  const checkIn = searchParams.get('checkIn') ?? undefined;
  const fromRecommendation = searchParams.get('recommended') === '1';
  const [sessionId, setSessionId] = useState<string | null>(null);
  const voiceEnable = useRef<(() => Promise<void>) | null>(null);
  const voiceSync = useRef<((move: TutorMove) => Promise<void>) | null>(null);
  const renderedMoves = useRef(new Set<string>());
  const syncVoiceMove = useCallback((move: TutorMove) => {
    renderedMoves.current.add(move.id);
    void voiceSync.current?.(move);
  }, []);
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
      onSessionStarted: setSessionId,
    });
  }, [arrivalId, checkIn, failure, fromRecommendation, props.grade, props.subject, scenario]);
  const session = useTutorSession({
    band,
    createSource,
    grade: props.grade,
    subjectId: props.subject,
    ...(scenario === null ? { onSpeak: () => voiceEnable.current?.() ?? Promise.resolve() } : {}),
    ...(scenario === null ? { onMove: syncVoiceMove } : {}),
    ...(startupEvents === undefined ? {} : { startupEvents }),
  });
  const voice = useRealtimeVoice({
    sessionId,
    autoEnable: searchParams.get('voice') === '1',
    api: sessionApi,
    renderedMoves: renderedMoves.current,
    onMove: session.receive,
  });
  voiceEnable.current = voice.enable;
  voiceSync.current = voice.syncMove;
  return (
    <SessionView
      band={band}
      scenario={scenario}
      session={session}
      subject={props.subject}
      voice={voice}
    />
  );
}

function SessionView(props: {
  band: ReturnType<typeof bandForGrade>;
  scenario: string | null;
  session: ReturnType<typeof useTutorSession>;
  subject: string;
  voice: ReturnType<typeof useRealtimeVoice>;
}): React.JSX.Element {
  return (
    <div className="session-app" data-band={props.band}>
      <SessionTopbar band={props.band} subject={props.subject} />
      <ConnectionNotice band={props.band} status={props.session.connectionStatus} />
      <main>
        <h1 className="visually-hidden">{props.subject} learning session</h1>
        {props.band === 'early' ? (
          <EarlyLayout session={props.session} />
        ) : props.band === 'middle' ? (
          <MiddleLayout session={props.session} />
        ) : (
          <SeniorLayout session={props.session} />
        )}
      </main>
      {props.scenario === null && !props.session.state.ended ? (
        <VoiceControls voice={props.voice} />
      ) : null}
    </div>
  );
}
