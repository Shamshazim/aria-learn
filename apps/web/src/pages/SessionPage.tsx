import { useCallback, useMemo, useRef, useState } from 'react';
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
  voiceAvailability,
} from '@/features/session';
import type { LiveVoice } from '@/features/session/model/live-voice';
import { isVoiceLive } from '@/features/voice/model/voice-state';
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
  const scenario = searchParams.get('scenario');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [voiceLive, setVoiceLive] = useState(false);
  const voiceEnable = useRef<(() => Promise<void>) | null>(null);
  const voiceSync = useRef<((move: TutorMove) => Promise<void>) | null>(null);
  const renderedMoves = useRef(new Set<string>());
  const syncVoiceMove = useCallback((move: TutorMove) => {
    renderedMoves.current.add(move.id);
    void voiceSync.current?.(move);
  }, []);
  const createSource = useTutorSource(props, searchParams, setSessionId);
  const session = useTutorSession({
    band,
    createSource,
    grade: props.grade,
    subjectId: props.subject,
    voiceLive,
    ...(scenario === null ? { onSpeak: () => voiceEnable.current?.() ?? Promise.resolve() } : {}),
    ...(scenario === null ? { onMove: syncVoiceMove } : {}),
    ...(startupEvents === undefined ? {} : { startupEvents }),
  });
  const voice = useRealtimeVoice({
    sessionId,
    ended: session.state.ended,
    autoEnable: searchParams.get('voice') === '1',
    api: sessionApi,
    renderedMoves: renderedMoves.current,
    onMove: session.receive,
    onAgentState: session.voiceState,
  });
  voiceEnable.current = voice.enable;
  voiceSync.current = voice.syncMove;
  const live = useLiveVoice(voice, voiceLive, setVoiceLive);
  const withVoiceAnswers = useVoiceAnswers(session, voice.answerOnScreen, voice.skipOnScreen);
  return (
    <SessionView
      band={band}
      live={live}
      scenario={scenario}
      session={withVoiceAnswers}
      subject={props.subject}
      voice={voice}
    />
  );
}

/** Where the moves come from: a scripted scenario, a staged failure, or the API. */
function useTutorSource(
  props: SessionProps,
  searchParams: URLSearchParams,
  setSessionId: (sessionId: string) => void,
): () => ReturnType<typeof createHttpTutorSource> {
  const failure = searchParams.get('failure');
  const scenario = searchParams.get('scenario');
  const arrivalId = searchParams.get('arrivalId') ?? undefined;
  const checkIn = searchParams.get('checkIn') ?? undefined;
  const fromRecommendation = searchParams.get('recommended') === '1';
  return useCallback(() => {
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
  }, [
    arrivalId,
    checkIn,
    failure,
    fromRecommendation,
    props.grade,
    props.subject,
    scenario,
    setSessionId,
  ]);
}

/**
 * What the layouts show of the voice, and whether a worker is connected at all. The worker is
 * the only thing that knows when Aria has finished talking, so "live" is state the session
 * hook reads, not something derived from the last move.
 */
function useLiveVoice(
  voice: ReturnType<typeof useRealtimeVoice>,
  voiceLive: boolean,
  setVoiceLive: (live: boolean) => void,
): LiveVoice {
  const live = isVoiceLive(voice.status);
  if (live !== voiceLive) setVoiceLive(live);
  return useMemo(
    () => ({
      talks: voice.talks,
      transcript: voice.transcript,
      heard: voice.heard,
      speaking: voice.speaking,
    }),
    [voice.heard, voice.speaking, voice.talks, voice.transcript],
  );
}

/**
 * "Aria talks": what the child taps, types or skips goes to her voice first, so she reacts
 * to it out loud; the API path is what remains when there is no talking voice to give it to.
 */
function useVoiceAnswers(
  session: ReturnType<typeof useTutorSession>,
  answerOnScreen: ReturnType<typeof useRealtimeVoice>['answerOnScreen'],
  skipOnScreen: ReturnType<typeof useRealtimeVoice>['skipOnScreen'],
): ReturnType<typeof useTutorSession> {
  const openId = session.state.openQuestion?.id ?? null;
  return useMemo(
    () => ({
      ...session,
      answer: async (moveId, value) => {
        if (!(await answerOnScreen(moveId, value))) await session.answer(moveId, value);
      },
      skip: async () => {
        if (openId === null || !(await skipOnScreen(openId))) await session.skip();
      },
    }),
    [answerOnScreen, openId, session, skipOnScreen],
  );
}

function SessionView(props: {
  band: ReturnType<typeof bandForGrade>;
  live: LiveVoice;
  scenario: string | null;
  session: ReturnType<typeof useTutorSession>;
  subject: string;
  voice: ReturnType<typeof useRealtimeVoice>;
}): React.JSX.Element {
  const scripted = props.scenario !== null;
  const voice = voiceAvailability(scripted ? null : props.voice.status, { scripted });
  const layout = { live: props.live, session: props.session, voice };
  return (
    <div className="session-app" data-band={props.band}>
      <SessionTopbar band={props.band} subject={props.subject} />
      <ConnectionNotice band={props.band} status={props.session.connectionStatus} />
      <main>
        <h1 className="visually-hidden">{props.subject} learning session</h1>
        {props.band === 'early' ? (
          <EarlyLayout {...layout} />
        ) : props.band === 'middle' ? (
          <MiddleLayout {...layout} />
        ) : (
          <SeniorLayout {...layout} />
        )}
      </main>
      {props.scenario === null && !props.session.state.ended ? (
        <VoiceControls voice={props.voice} />
      ) : null}
    </div>
  );
}
