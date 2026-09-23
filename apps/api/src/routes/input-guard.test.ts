import { describe, expect, it } from 'vitest';

import { findLooseObjects } from '@aria/shared';

import { validationOf } from '@/middleware/validate';
import { createApiRouter } from '@/routes';
import { buildIdentity } from '@/routes/__fixtures__/identity-app.fixture';
import { walkRoutes, type MountedRoute } from '@/routes/__fixtures__/route-walk';

import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

/**
 * X-05: "an unknown field is rejected, proven per route".
 *
 * Proven per route and not per schema, because the two are different claims. A strict schema
 * that no router mounts protects nothing, and a route that forgot `validate` is exactly the
 * route an attacker wants. So this walks the mounted app, asks each route what it parses, and
 * fails on either mistake — including for a route written next year, which is the only way a
 * guard like this stays true.
 */
const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

describe('every mounted route', () => {
  const routes = mountedRoutes();

  it('is discovered, so an empty walk would not pass by accident', () => {
    expect(routes.length).toBeGreaterThan(20);
    expect(routes.map(label)).toContain('POST /student/session/turn');
  });

  it.each(routes.map((route) => [label(route), route] as const))(
    'parses every part of %s with a schema that rejects unknown fields',
    (_name, route) => {
      const loose = validatorsOn(route).flatMap(({ target, schema }) =>
        findLooseObjects(schema).map((finding) => `${target}.${finding.path}`),
      );

      expect(loose).toEqual([]);
    },
  );

  it.each(mutatingRoutes(routes).map((route) => [label(route), route] as const))(
    'validates the body of %s, rather than trusting it',
    (_name, route) => {
      expect(validatorsOn(route).map(({ target }) => target)).toContain('body');
    },
  );
});

/**
 * There is no exception list, and that is the design: a route that takes nothing says so with
 * `noBodySchema` rather than by being named here. An exception list is a place for a route to
 * hide, and the one route that hides is the one that mattered.
 *
 * A wildcard path is not a route. `router.post('/parent/*splat', replay)` mounts middleware
 * across a prefix, and Express records it in the same stack as an endpoint; the routes it
 * covers are checked individually below.
 */
function mutatingRoutes(routes: readonly MountedRoute[]): readonly MountedRoute[] {
  return routes.filter((route) => MUTATING.has(route.method) && !route.path.includes('*'));
}

function validatorsOn(
  route: MountedRoute,
): readonly Readonly<{ target: string; schema: ZodType }>[] {
  return route.handlers
    .map((handler) => validationOf(handler))
    .filter((validation): validation is NonNullable<typeof validation> => validation !== null);
}

function label(route: MountedRoute): string {
  return `${route.method} ${route.path}`;
}

/**
 * Every router the API can mount, at once.
 *
 * The controllers are stubs on purpose: nothing here calls one. What is real is the routers,
 * which is where a missing `validate` would live.
 */
function mountedRoutes(): readonly MountedRoute[] {
  const ok: RequestHandler = (_request, response) => {
    response.json({ data: {} });
  };
  return walkRoutes(
    createApiRouter({
      healthController: { get: ok },
      identity: buildIdentity().identity,
      status: { controller: { get: ok }, authorize: ok },
      student: {
        authorize: ok,
        arrival: ok,
        sessions: { create: ok, current: ok, end: ok, turn: ok },
      },
      voice: {
        student: { authorize: ok, controller: voiceControllers(ok) },
        worker: {
          authorize: ok,
          controller: voiceControllers(ok),
          bridges: { library: ok, audio: ok },
          talk: { brief: ok, heard: ok, spoken: ok, screen: ok },
        },
        admin: { authorize: ok, controller: voiceControllers(ok) },
      },
    }),
  );
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
