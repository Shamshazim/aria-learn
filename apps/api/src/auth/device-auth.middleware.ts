import { UnauthorizedError } from '@/errors';
import type { DevicesService } from '@/services/parent/devices.service';
import type { DeviceGrant } from '@/types/parent-access';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * A tablet proving it was trusted, without a parent being signed in on it (P0-28).
 *
 * The header carries the grant secret. It is not a cookie: a device grant is not a session,
 * it is a long-lived capability held by the *device*, and putting it in a cookie would make
 * it something a browser attaches to requests nobody meant it to.
 *
 * The scope check is not here. Which children this grant may open depends on the child being
 * asked for, which is the controller's business; this middleware answers the narrower
 * question — is this a device we know — and puts the grant on the request.
 */
export const DEVICE_HEADER = 'x-aria-device';

/** A header longer than this is not a secret we issued; reading it further is wasted work. */
const MAX_HEADER_BYTES = 512;

export function requireDeviceGrant(deps: { devices: DevicesService }): RequestHandler {
  return (req: Request, _response: Response, next: NextFunction): void => {
    const secret = deviceHeader(req);
    if (secret === null) {
      next(new UnauthorizedError('no device secret on a device route'));
      return;
    }

    // `identify` and not `authorise`: no child has been named yet.
    //
    // The refusal goes through `next`, not a `throw`. A throw inside the fulfilment handler
    // of `.then(onFulfilled, onRejected)` is not caught by that same `onRejected` — it
    // escapes as an unhandled rejection and the request hangs until it times out.
    void deps.devices
      .identify(secret)
      .then((grant) => {
        if (grant === null) {
          next(new UnauthorizedError('device secret is unknown or revoked'));
          return;
        }
        req.deviceGrant = grant;
        req.deviceSecret = secret;
        next();
      })
      .catch(next);
  };
}

export function deviceHeader(request: Request): string | null {
  const raw = request.headers[DEVICE_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === '' || value.length > MAX_HEADER_BYTES) return null;
  return value;
}

/** The grant this request proved, for a controller whose next line has no meaning without. */
export function requireGrant(request: Request): DeviceGrant {
  const grant = request.deviceGrant;
  if (grant === undefined) throw new Error('device auth middleware was not run');
  return grant;
}

declare module 'express-serve-static-core' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Request {
    /** Set by `requireDeviceGrant`. Never present on a parent route. */
    deviceGrant?: DeviceGrant;
    deviceSecret?: string;
  }
}
