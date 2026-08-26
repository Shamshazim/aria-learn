import { z } from 'zod';

import type { Response } from 'supertest';

/**
 * Reading an API response in a test the same way a client would (P2H-12).
 *
 * `response.body` is `any`, and reaching into it is how a test comes to assert on a field
 * that no longer exists. Parsing the envelope against the schema the endpoint promises means
 * a shape change fails the test that depends on it, at the line that depends on it.
 */
export function parseEnvelope<Output>(schema: z.ZodType<Output>, response: Response): Output {
  return z.object({ data: schema }).parse(JSON.parse(response.text)).data;
}

const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string() }),
});

/** The one error body the API speaks, for the tests that assert on a refusal. */
export function parseError(response: Response): z.infer<typeof errorSchema>['error'] {
  return errorSchema.parse(JSON.parse(response.text)).error;
}
