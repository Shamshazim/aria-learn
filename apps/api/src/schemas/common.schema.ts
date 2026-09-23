import { z } from 'zod';

/**
 * The body of a route that takes no body (X-05).
 *
 * A route whose whole input is the authenticated actor still has to say so. Without a schema
 * the body is simply never looked at, so `POST /parent/sessions/revoke {"parentId": "…"}` is
 * accepted, ignored, and indistinguishable in a log from a request that meant it — which is
 * the shape of every "we thought that field did nothing" incident.
 *
 * Absent is allowed because Express leaves `req.body` undefined when no payload arrives, and
 * a client with nothing to send should not have to send `{}` to be understood.
 */
export const noBodySchema = z.strictObject({}).optional();
