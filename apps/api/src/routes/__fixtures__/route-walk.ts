import type { Router } from 'express';

/**
 * Every path an Express router will answer, found by walking it (P2H-12).
 *
 * The point is that it is discovered rather than listed. A route added to `student.routes.ts`
 * next year appears here without anybody remembering to add it, which is what makes the guard
 * test a guard rather than a snapshot of what somebody once wrote down.
 */
export type MountedRoute = Readonly<{ method: string; path: string }>;

export function walkRoutes(router: Router): readonly MountedRoute[] {
  return layersOf(router).flatMap(routesIn);
}

type Layer = Readonly<{
  route?: Readonly<{ path?: unknown; methods?: Readonly<Record<string, unknown>> }>;
  handle?: unknown;
}>;

function routesIn(layer: Layer): readonly MountedRoute[] {
  const path = layer.route?.path;
  if (typeof path === 'string') {
    return Object.entries(layer.route?.methods ?? {})
      .filter(([, enabled]) => enabled === true)
      .map(([method]) => ({ method: method.toUpperCase(), path }));
  }
  // A mounted sub-router: its own stack is where the paths actually are.
  return layersOf(layer.handle).flatMap(routesIn);
}

function layersOf(value: unknown): readonly Layer[] {
  if (typeof value !== 'function' && (typeof value !== 'object' || value === null)) return [];
  const stack: unknown = Object.getOwnPropertyDescriptor(value, 'stack')?.value;
  if (!Array.isArray(stack)) return [];
  return stack.filter((layer): layer is Layer => typeof layer === 'object' && layer !== null);
}
