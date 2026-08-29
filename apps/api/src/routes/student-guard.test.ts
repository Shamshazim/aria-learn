import { createHmac } from 'node:crypto';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '@/app';
import { requireChildSession } from '@/auth';
import { fakeChildSessions } from '@/auth/__fixtures__/identity.fixture';
import { createChildSessionService } from '@/auth/child-session.service';
import { loadConfig } from '@/config';
import { fixedClock } from '@/lib/clock';
import { sequentialIds, sequentialUuids } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { sequentialTokens } from '@/lib/tokens';
import { API_PREFIX, createApiRouter } from '@/routes';
import type { RouterDeps } from '@/routes';
import { walkRoutes } from '@/routes/__fixtures__/route-walk';

import type { Express, RequestHandler } from 'express';

/**
 * P2H-12: "every student route rejects requests without a valid child session".
 *
 * The routes are discovered by walking the router, not listed here, so a route added later
 * without the gate fails this test on the day it is added rather than in an incident.
 */
const NOW = new Date('2026-08-25T10:00:00.000Z');
const CONFIG = loadConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://aria:aria@localhost:5432/aria_test',
    SUPABASE_URL: 'https://project.supabase.co',
    CHILD_SESSION_SECRET: 'c'.repeat(32),
  },
  'test',
);

const SESSION_ID = '00000000-0000-4000-8000-0000000000dd';

function build() {
  const sessions = createChildSessionService({
    sessions: fakeChildSessions(),
    clock: fixedClock(NOW),
    ids: sequentialUuids(),
    tokens: sequentialTokens(),
  });
  const authorize = requireChildSession({
    sessions,
    expiry: { endFor: () => Promise.resolve(), sweep: () => Promise.resolve(0) },
  });
  return { sessions, deps: routerDeps(authorize) };
}

/** Controllers that answer 200 to anything, so the only thing under test is the gate. */
function routerDeps(authorize: RequestHandler): RouterDeps {
  const ok: RequestHandler = (_request, response) => {
    response.status(200).json({ data: { reached: true } });
  };
  return {
    healthController: { get: ok },
    student: {
      authorize,
      arrival: ok,
      sessions: { create: ok, current: ok, end: ok, turn: ok },
    },
    voice: {
      student: { authorize, controller: voiceControllers(ok) },
      worker: {
        authorize: ok,
        controller: voiceControllers(ok),
        bridges: { library: ok, audio: ok },
        talk: { brief: ok, heard: ok, spoken: ok },
      },
      admin: { authorize: ok, controller: voiceControllers(ok) },
    },
  };
}

function voiceControllers(ok: RequestHandler) {
  return {
    realtime: ok,
    workerTurn: ok,
    workerMetric: ok,
    grantConsent: ok,
    withdrawConsent: ok,
  };
}

function appFor(deps: RouterDeps): Express {
  return createApp({
    config: CONFIG,
    logger: createLogger({ level: 'silent' }),
    clock: fixedClock(NOW),
    ids: sequentialIds('req'),
    ...(deps.student === undefined ? {} : { student: deps.student }),
    ...(deps.voice === undefined ? {} : { voice: deps.voice }),
  });
}

function childRoutes(deps: RouterDeps): readonly Readonly<{ method: string; path: string }>[] {
  return walkRoutes(createApiRouter(deps)).filter((route) => route.path.startsWith('/student'));
}

function url(path: string): string {
  return `${API_PREFIX}${path.replace(':id', SESSION_ID)}`;
}

describe('the gate on every student route', () => {
  it('found the student routes to check', () => {
    const paths = childRoutes(build().deps).map((route) => `${route.method} ${route.path}`);

    expect(paths).toContain('POST /student/arrival');
    expect(paths).toContain('POST /student/session/:id/realtime');
    expect(paths.length).toBeGreaterThanOrEqual(6);
  });

  it('refuses every one of them without a cookie', async () => {
    const { deps } = build();
    const app = appFor(deps);

    for (const route of childRoutes(deps)) {
      const response = await request(app)[methodOf(route.method)](url(route.path));
      expect({ path: route.path, status: response.status }).toEqual({
        path: route.path,
        status: 401,
      });
    }
  });

  it('refuses a cookie that was never signed by us', async () => {
    const { deps } = build();

    const response = await request(appFor(deps))
      .post(`${API_PREFIX}/student/arrival`)
      .set('Cookie', 'aria_child_session=s%3Amade-up.not-a-signature');

    expect(response.status).toBe(401);
  });

  /**
   * Past the gate, not necessarily to a 200: several of these routes validate a body this
   * test does not send, and a 400 from the validator is still proof the gate let it through.
   */
  it('lets a signed-in child past every one of them', async () => {
    const { deps, sessions } = build();
    const app = appFor(deps);
    const issued = await sessions.issue({
      studentId: '00000000-0000-4000-8000-000000000001',
      parentId: '00000000-0000-4000-8000-0000000000a1',
      deviceLabel: null,
    });
    const cookie = signedCookie(issued.token);

    for (const route of childRoutes(deps)) {
      const response = await request(app)
        [methodOf(route.method)](url(route.path))
        .set('Cookie', cookie);
      expect({ path: route.path, unauthorized: response.status === 401 }).toEqual({
        path: route.path,
        unauthorized: false,
      });
    }
  });
});

/**
 * The same signature `cookie-parser` will check, produced the way `cookie-signature` produces
 * it: the value, a dot, and a base64 HMAC with the trailing padding removed.
 */
function signedCookie(token: string): string {
  const mac = createHmac('sha256', CONFIG.auth?.childSessionSecret ?? '')
    .update(token)
    .digest('base64')
    .replace(/=+$/u, '');
  return `aria_child_session=${encodeURIComponent(`s:${token}.${mac}`)}`;
}

function methodOf(method: string): 'get' | 'post' | 'patch' | 'put' | 'delete' {
  const known = ['get', 'post', 'patch', 'put', 'delete'] as const;
  const found = known.find((candidate) => candidate === method.toLowerCase());
  if (found === undefined) throw new Error(`unsupported method ${method}`);
  return found;
}
