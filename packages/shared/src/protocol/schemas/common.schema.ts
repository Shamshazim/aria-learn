import { z } from 'zod';

import { SUPPORTED_PROTOCOL_VERSIONS } from '../../version';

/**
 * The primitives every event and every move is built from.
 *
 * These live in one place so the envelope cannot drift between the two unions: a move and
 * the event that answers it are stamped by the same fields, which is what makes a session
 * replayable from `session_event` later (`master-plan.md` §4.1 step 5).
 */

/** Bounded so a malformed or hostile payload cannot become an unbounded allocation (§8). */
const MAX_ID_LENGTH = 128;

export const sessionIdSchema = z.string().min(1).max(MAX_ID_LENGTH).brand<'SessionId'>();
export type SessionId = z.infer<typeof sessionIdSchema>;

export const messageIdSchema = z.string().min(1).max(MAX_ID_LENGTH);
export const sequenceSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

/** ISO-8601 in UTC. `offset: false` rejects `+05:30`, so every timestamp is comparable. */
export const timestampSchema = z.iso.datetime({ offset: false });

export const protocolVersionSchema = z.enum(SUPPORTED_PROTOCOL_VERSIONS);

/**
 * The fields on every event and move.
 *
 * `sessionId` is optional because the relationship starts before a session exists: `ARRIVED`
 * and the `WELCOME` answering it are exchanged while the child is still choosing a class
 * (`master-plan.md` §4.1).
 */
export const envelopeShape = {
  id: messageIdSchema,
  at: timestampSchema,
  sessionId: sessionIdSchema.optional(),
  protocolVersion: protocolVersionSchema,
  turnId: messageIdSchema.optional(),
  connectionEpoch: sequenceSchema.optional(),
} as const;

export const envelopeSchema = z.object(envelopeShape);
export type Envelope = z.infer<typeof envelopeSchema>;

/**
 * What a move sounds like.
 *
 * Present on *every* move, `null` when there is nothing to say, so Phase 2 can speak any
 * move without a protocol change. `ssml` is optional detail for a voice that supports it;
 * `text` is what a caption shows and what a text-only session displays.
 */
export const speechSchema = z
  .object({
    text: z.string().min(1).max(2000),
    ssml: z.string().max(8000).optional(),
    /**
     * P2H-08: the same sentence with prosody in it, vendor-neutral (`@aria/voice` markers).
     *
     * Set only when the harness has something to say about *how* a line is said — an
     * emphasised word, a beat. It never reaches a screen: `text` is what is displayed and
     * `prosody` is what is spoken, and the two diverge here on purpose.
     */
    prosody: z.string().min(1).max(4000).optional(),
    assetId: messageIdSchema.optional(),
  })
  .nullable();

export type Speech = z.infer<typeof speechSchema>;

/**
 * The input control a move expects back.
 *
 * The UI derives its control from this field and never from the move kind, so adding a move
 * does not mean touching a renderer's switch (CODE-STANDARDS §4).
 */
export const EXPECTS = ['choice', 'text', 'number', 'speech', 'drag', 'none'] as const;

export const expectsSchema = z.enum(EXPECTS);
export type Expects = z.infer<typeof expectsSchema>;
