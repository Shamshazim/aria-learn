import { z } from 'zod';

import { bandSchema } from '@aria/shared';

/**
 * What one adversarial case looks like on disk (X-05).
 *
 * The fixtures are data, not code, for one reason: a case is added after an incident, by
 * whoever saw it, without touching the harness. The ticket says "a new fixture is added for
 * every reported incident before its fix is merged" — that only happens if adding one is
 * writing a paragraph of JSON.
 *
 * Every case says what it is trying to do (`note`) as well as what it sends, because a year
 * from now the sentence is the only thing that explains why the expectation is what it is.
 */
const idSchema = z
  .string()
  .regex(/^[a-z0-9-]+$/u, 'ids are lower-case and hyphenated')
  .max(64);

/** Something a child says or a vendor transcribes: free text through the real turn path. */
export const injectionFixtureSchema = z
  .strictObject({
    id: idSchema,
    note: z.string().min(10).max(300),
    text: z.string().min(1).max(20_000),
    band: bandSchema.default('middle'),
    /** The deterministic intent this must reach, where reaching it is the whole point. */
    expectIntent: z
      .enum(['PERSONAL_INFO', 'STOP_REQUEST', 'CONFUSED', 'QUESTION', 'CHAT', 'ANSWER', 'UNCLEAR'])
      .optional(),
    /** True where the answer must come from reviewed text, with no vendor call at all. */
    expectNoModelCall: z.boolean().default(false),
    /** Must reach crisis routing, which `master-plan.md` §12 forbids delegating to a model. */
    expectCrisis: z.boolean().default(false),
    /** Strings that must never appear in what Aria says back — usually the child's own words. */
    mustNotEcho: z.array(z.string().min(1).max(200)).max(8).default([]),
  })
  .array()
  .min(1);

/** A parent's free text on its way to a vendor: what the scrubber must not let through. */
export const parentAskFixtureSchema = z
  .strictObject({
    id: idSchema,
    note: z.string().min(10).max(300),
    text: z.string().min(1).max(4_000),
    /** Substrings that must be gone from the text a vendor would receive. */
    mustNotReachVendor: z.array(z.string().min(1).max(200)).min(1).max(8),
  })
  .array()
  .min(1);

/** A frame on the data channel: what the worker must refuse before the harness sees it. */
export const realtimeFixtureSchema = z
  .strictObject({
    id: idSchema,
    note: z.string().min(10).max(300),
    /** The raw frame. A string is sent verbatim; anything else is serialised first. */
    frame: z.unknown(),
    /** Set where the case is a payload too large to be JSON in this file. */
    repeatToBytes: z.number().int().min(1).max(1_000_000).optional(),
    /** False for the control cases: a valid frame must still get through. */
    expectRejected: z.boolean().default(true),
  })
  .array()
  .min(1);

export type InjectionFixture = z.infer<typeof injectionFixtureSchema>[number];
export type ParentAskFixture = z.infer<typeof parentAskFixtureSchema>[number];
export type RealtimeFixture = z.infer<typeof realtimeFixtureSchema>[number];
