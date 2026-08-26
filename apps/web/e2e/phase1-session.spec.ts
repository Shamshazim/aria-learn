import { expect, test, type Page } from '@playwright/test';

import { PROTOCOL_VERSION, type Band, type Grade } from '@aria/shared';

import { signedInChild } from './fixtures/signed-in';

const SESSION_ID = '00000000-0000-4000-8000-000000000301';
type Profile = Readonly<{ band: Band; grade: Grade }>;
const PROFILES: readonly Profile[] = [
  { band: 'early', grade: '1' },
  { band: 'middle', grade: '4' },
  { band: 'senior', grade: '7' },
];

for (const profile of PROFILES) {
  test(`${profile.band} real HTTP source completes a wrong-answer session`, async ({ page }) => {
    await setupSessionRoutes(page, profile);

    await signedInChild(page);

    await page.goto(`/session/${profile.grade}/math`);
    await page.getByText('What is four plus three?').waitFor();
    await page.getByRole('button', { name: '6', exact: true }).click();
    await page.getByText('Start at four and count on three.').waitFor();
    await page.getByRole('button', { name: 'End session' }).click();
    await expect(page.getByRole('heading', { name: 'You did it.' })).toBeVisible();
  });
}

async function setupSessionRoutes(page: Page, profile: Profile): Promise<void> {
  let turn = 0;
  await page.route('**/api/v1/student/session/current', (route) =>
    route.fulfill(json({ data: null })),
  );
  await page.route('**/api/v1/student/session', (route) =>
    route.fulfill(json({ data: sessionStart(profile) })),
  );
  await page.route('**/api/v1/student/session/turn', (route) => {
    turn += 1;
    const responseMove =
      turn === 1
        ? move('HINT', 'Start at four and count on three.', { attempt: 1 })
        : move('END', 'You kept trying.', { learned: ['addition'], reason: 'child_left' });
    return route.fulfill(
      json({
        data: {
          protocolVersion: PROTOCOL_VERSION,
          sessionId: SESSION_ID,
          inResponseTo: `web-event-${String(turn + 2)}`,
          at: '2026-08-24T20:00:00.000Z',
          moves: [responseMove],
        },
      }),
    );
  });
}

function sessionStart(profile: Profile): unknown {
  return {
    session: {
      sessionId: SESSION_ID,
      subjectId: 'math',
      grade: profile.grade,
      band: profile.band,
      startedAt: '2026-08-24T20:00:00.000Z',
    },
    moves: [
      move('ASK', 'What is four plus three?', {
        itemId: 'item-1',
        expects: 'choice',
        display: [
          {
            type: 'choices',
            options: [
              { id: '6', label: '6' },
              { id: '7', label: '7' },
            ],
          },
        ],
      }),
    ],
    resumed: false,
  };
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

function json(body: unknown): Readonly<{ status: number; contentType: string; body: string }> {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) };
}
