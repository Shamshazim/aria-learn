import { z } from 'zod';

/**
 * The health resource, as a schema rather than a hand-written type.
 *
 * A response schema looks redundant until the first time a field is renamed in a mapper and
 * nothing catches it. The type is `z.infer` of this, so the contract and the type cannot
 * drift (CODE-STANDARDS §1).
 */
export const healthStatusSchema = z.object({
  status: z.literal('ok'),
  version: z.string().min(1),
  uptimeSeconds: z.number().nonnegative(),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
