import { PROTOCOL_VERSION, type Band, type Grade } from '@aria/shared';

import type { Page } from '@playwright/test';

export const SESSION_ID = '00000000-0000-4000-8000-000000000301';

export type Profile = Readonly<{ band: Band; grade: Grade }>;

export const PROFILES: readonly Profile[] = [
  { band: 'early', grade: '1' },
  { band: 'middle', grade: '4' },
  { band: 'senior', grade: '7' },
];

type Expects = 'choice' | 'text';

type SessionRoutes = Readonly<{
  /** How the first question wants its answer. Every shape also accepts speech in the UI. */
  expects?: Expects;
  /** Voice negotiation outcome; `403` is a child without parental voice consent. */
  realtime?: 403 | 503;
  /** Reply to the first turn with the question again — what the API does for a stale answer. */
  resyncFirstTurn?: boolean;
}>;

/**
 * The real HTTP source against a scripted API: `create` returns one question, each `turn`
 * answers with a hint and then an ending. No LiveKit room is ever opened.
 */
export async function setupSessionRoutes(
  page: Page,
  profile: Profile,
  routes: SessionRoutes = {},
): Promise<void> {
  let turn = 0;
  await page.route('**/api/v1/student/session/current', (route) =>
    route.fulfill(json({ data: null })),
  );
  await page.route('**/api/v1/student/session', (route) =>
    route.fulfill(json({ data: sessionStart(profile, routes.expects ?? 'choice') })),
  );
  await page.route('**/api/v1/student/session/*/realtime', (route) =>
    route.fulfill({
      status: routes.realtime ?? 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'FORBIDDEN', message: 'consent required' } }),
    }),
  );
  await page.route('**/api/v1/student/session/turn', (route) => {
    turn += 1;
    const moves =
      turn === 1 && routes.resyncFirstTurn === true
        ? [askMove(routes.expects ?? 'choice')]
        : [turnMove(turn === 1 || (turn === 2 && routes.resyncFirstTurn === true))];
    return route.fulfill(
      sse({
        kind: 'TURN_MOVES',
        turn: {
          protocolVersion: PROTOCOL_VERSION,
          sessionId: SESSION_ID,
          inResponseTo: `web-event-${String(turn + 2)}`,
          at: '2026-08-24T20:00:00.000Z',
          moves,
        },
      }),
    );
  });
}

/** One closing frame, the way `apps/api/src/controllers/turn-stream.ts` writes it. */
function sse(frame: unknown) {
  return {
    status: 200,
    contentType: 'text/event-stream',
    body: `data: ${JSON.stringify(frame)}\n\n`,
  };
}

function turnMove(hint: boolean): unknown {
  return hint
    ? move('HINT', 'Start at four and count on three.', { attempt: 1 })
    : move('END', 'You kept trying.', { learned: ['addition'], reason: 'child_left' });
}

function sessionStart(profile: Profile, expects: Expects): unknown {
  return {
    session: {
      sessionId: SESSION_ID,
      subjectId: 'math',
      grade: profile.grade,
      band: profile.band,
      startedAt: '2026-08-24T20:00:00.000Z',
    },
    moves: [askMove(expects)],
    resumed: false,
  };
}

function askMove(expects: Expects): unknown {
  return move('ASK', 'What is four plus three?', {
    itemId: 'item-1',
    expects,
    display:
      expects === 'choice'
        ? [
            {
              type: 'choices',
              options: [
                { id: '6', label: '6' },
                { id: '7', label: '7' },
              ],
            },
          ]
        : [],
  });
}

function move(kind: string, text: string, fields: Readonly<Record<string, unknown>>) {
  return {
    id: `move-${kind}`,
    at: '2026-08-24T20:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: SESSION_ID,
    kind,
    speech: { text },
    display: [],
    expects: 'none',
    ...fields,
  };
}

function json(body: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) };
}
