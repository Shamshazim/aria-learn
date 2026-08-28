/**
 * What "the deploy worked" means, as checks rather than as a feeling.
 *
 * Pure: each function takes what a probe returned and says whether it is acceptable. The
 * network lives in `tools/bin/smoke.ts`, so the rules a release is gated on can be tested
 * without one (X-01).
 */
export type SmokeCheck = { name: string; ok: boolean; detail: string };

/** The health payload P0-24 serves. Only the fields a gate should read. */
export type HealthPayload = {
  status?: unknown;
  version?: unknown;
};

/**
 * `degraded` passes. A release that cannot reach a model provider is still a release that
 * should replace a broken one, and P0-25 already gives a child a real experience when the
 * tutor is unavailable. Only `down` — or an unparseable answer — fails.
 */
export function checkHealth(status: number, body: unknown): SmokeCheck {
  if (status !== 200) {
    return { name: 'api health', ok: false, detail: `HTTP ${String(status)}` };
  }

  const payload = body as HealthPayload;
  const reported = typeof payload.status === 'string' ? payload.status : 'unreadable';

  return {
    name: 'api health',
    ok: reported === 'ok' || reported === 'degraded',
    detail: `status=${reported}`,
  };
}

/**
 * The release actually changed. Without this a deploy that silently rolled back to the
 * previous image passes every other check in this file.
 */
export function checkVersion(body: unknown, expected: string | undefined): SmokeCheck {
  if (expected === undefined || expected === '') {
    return { name: 'api version', ok: true, detail: 'not asserted' };
  }

  const reported = (body as HealthPayload).version;
  return {
    name: 'api version',
    ok: reported === expected,
    detail: `expected ${expected}, serving ${String(reported)}`,
  };
}

/** The web app is served and its SPA fallback works, which is a different failure from 200 /. */
export function checkWebRoute(status: number, contentType: string | null): SmokeCheck {
  return {
    name: 'web spa route',
    ok: status === 200 && contentType?.includes('text/html') === true,
    detail: `HTTP ${String(status)} ${String(contentType)}`,
  };
}

/**
 * The bundle points at this environment's API. It is baked in at build time, so the way this
 * goes wrong is a staging image promoted to production — which every other check passes.
 */
export function checkApiOrigin(
  html: string,
  assets: readonly string[],
  expected: string,
): SmokeCheck {
  const found = assets.some((asset) => asset.includes(expected)) || html.includes(expected);

  return {
    name: 'web api origin',
    ok: found,
    detail: found ? expected : `${expected} not in bundle`,
  };
}

export function summarise(checks: readonly SmokeCheck[]): string {
  return checks
    .map((check) => `${check.ok ? 'PASS' : 'FAIL'}  ${check.name}  ${check.detail}`)
    .join('\n');
}

export function allPassed(checks: readonly SmokeCheck[]): boolean {
  return checks.every((check) => check.ok);
}
