import { z } from 'zod';

import { bandSchema, gradeSchema } from '../../band/band';
import { childPictureSchema } from '../../identity/pictures';

/**
 * What a child screen is allowed to know about a family (P2H-12).
 *
 * The picker is the first screen a child sees, and it is rendered from this and nothing else.
 * There is no parent email here, no address and no id that is not the child's own, because
 * master-plan.md §12 asks that nothing identifying about the adult reach a child's device —
 * and a shape with no field for it cannot leak one by accident.
 */
export const childSummarySchema = z.object({
  id: z.uuid(),
  firstName: z.string().min(1).max(64),
  grade: gradeSchema,
  band: bandSchema,
  avatar: childPictureSchema,
  /** What this child has to do to get in. `none` means a grown-up has not set it up yet. */
  loginMethod: z.enum(['pin', 'picture', 'family-device', 'none']),
});

export const childListResponseSchema = z.object({
  children: z.array(childSummarySchema).max(20),
});

/** The login response. The session itself travels as a cookie; this is what the UI shows. */
export const childSessionResponseSchema = z.object({
  child: childSummarySchema,
  /** Server-side truth. The client's idle timer is advisory and re-derived from this. */
  expiresAt: z.iso.datetime({ offset: false }),
  idleExpiresAt: z.iso.datetime({ offset: false }),
});

export type ChildSummary = z.infer<typeof childSummarySchema>;
export type ChildListResponse = z.infer<typeof childListResponseSchema>;
export type ChildSessionResponse = z.infer<typeof childSessionResponseSchema>;
