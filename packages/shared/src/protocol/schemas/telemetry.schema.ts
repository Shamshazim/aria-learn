import { z } from 'zod';

import { sessionIdSchema } from './common.schema';

/**
 * What the browser measured about one child's turn (X-04 part 2).
 *
 * Two of the bars in `master-plan.md` §11 cannot be observed anywhere else. "Audible welcome
 * after audio is activated — starts < 1s" begins the moment a browser lets a page make sound
 * and ends at the first sample out of the speaker; "child interruption stops Aria's speech
 * — < 250ms" begins when the child talks over her and ends when the room goes quiet. The
 * server sees neither end of either. Its own halves are shorter than the promise, and
 * reporting a shorter number under the name of the bar would be worse than reporting nothing.
 *
 * So the client sends what it saw, and this is the shape it sends it in.
 */

/**
 * The measurements a client may report, as a closed list.
 *
 * A list of `{ kind, ms }` rather than an object of named fields, because the reports are not
 * one per turn: arrival happens once, audio unlocks once, and an interrupt happens as often as
 * a child talks over Aria. Adding a bar later is a new member here and a new row in the API's
 * metric map — no change to the shape of the request, and no optional field that means "this
 * client is older" (CODE-STANDARDS §4).
 *
 * `audible_welcome` is `first_audio_ms` in the X-04 design sketch. It is named for the §11 bar
 * it feeds instead, so that the client's field, the API's histogram and the SLO id are one
 * word rather than three that a reader has to line up.
 */
export const CLIENT_TIMING_KINDS = [
  /** Arrival requested → the personalised welcome painted. The §11 visible-welcome bar. */
  'arrival_visible',
  /** Arrival painted → the browser permitted sound. Not a bar: it is why the next one starts. */
  'audio_unlocked',
  /** Sound permitted → the first audio out of the speaker. The §11 audible-welcome bar. */
  'audible_welcome',
  /** The child talked over Aria → the speaker went quiet. The §11 interrupt bar. */
  'interrupt_silence',
] as const;

export type ClientTimingKind = (typeof CLIENT_TIMING_KINDS)[number];

export const clientTimingKindSchema = z.enum(CLIENT_TIMING_KINDS);

/**
 * The structural ceiling on a duration, in milliseconds.
 *
 * Ten minutes. This is not a judgement about whether a measurement is believable — the API
 * makes that call, and makes it per bar — but a bound on what may enter the process at all
 * (CODE-STANDARDS §8). A number past this is not a slow tablet; it is a client bug or a
 * hostile payload, and neither deserves to be parsed.
 */
export const MAX_CLIENT_TIMING_MS = 600_000;

/** How many measurements one request may carry. A session has four kinds and a few repeats. */
export const MAX_CLIENT_TIMINGS_PER_REPORT = 16;

export const clientTimingSchema = z.strictObject({
  kind: clientTimingKindSchema,
  /**
   * A duration, never a pair of absolute times.
   *
   * The client's clock and the server's disagree — by seconds on a tablet nobody has synced,
   * and by hours on one whose timezone was set by hand. A duration measured between two
   * readings of the same monotonic clock is immune to all of that, and is the only number
   * here the server could not compute for itself.
   */
  ms: z.number().int().nonnegative().max(MAX_CLIENT_TIMING_MS),
});

export type ClientTiming = z.infer<typeof clientTimingSchema>;

/**
 * One report.
 *
 * The session id is the only identifier in it, and it is here so the server can find the band
 * to label the histogram with and the student to check the report against. Nothing else about
 * the child travels: no name, no device, no user agent, no absolute time (X-04, "student-
 * scoped, no PII beyond session id").
 *
 * It is optional for the same reason `envelopeShape.sessionId` is: the relationship starts
 * before a session exists. `arrival_visible` is measured on the class picker, where the child
 * has not chosen a class yet and there is nothing for a session id to name. The server falls
 * back to the band on the child's own profile, which is the band that arrival was composed for.
 */
export const turnTimingReportSchema = z.strictObject({
  sessionId: sessionIdSchema.optional(),
  timings: z.array(clientTimingSchema).min(1).max(MAX_CLIENT_TIMINGS_PER_REPORT),
});

export type TurnTimingReport = z.infer<typeof turnTimingReportSchema>;

/**
 * What the server made of the report.
 *
 * `dropped` is returned rather than kept quiet so a client can see that its measurements are
 * not landing. Telemetry that is silently discarded is worse than telemetry that is absent:
 * absent is visible in a dashboard, discarded looks like coverage.
 */
export const turnTimingResponseSchema = z.strictObject({
  recorded: z.number().int().nonnegative(),
  dropped: z.number().int().nonnegative(),
});

export type TurnTimingResponse = z.infer<typeof turnTimingResponseSchema>;
