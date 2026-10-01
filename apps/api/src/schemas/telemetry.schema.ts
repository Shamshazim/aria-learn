import { turnTimingReportSchema } from '@aria/shared';

/**
 * The request body of `POST /telemetry/turn` (X-04 part 2).
 *
 * Re-exported from `@aria/shared` rather than restated, because the browser builds the body
 * from the same schema. A second declaration here would be a second definition of one wire
 * format, and the two would agree exactly until the first change to either.
 *
 * The file exists anyway so that `schemas/` stays the one place a router looks for what a
 * route parses (CODE-STANDARDS §3.1) — a router reaching into `@aria/shared` for a request
 * schema is a router that knows where protocol lives, which is not its job.
 */
export const turnTimingRequestSchema = turnTimingReportSchema;
