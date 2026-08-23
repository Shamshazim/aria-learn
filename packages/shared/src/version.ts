/**
 * The version stamped on every event and move.
 *
 * It travels on the envelope rather than in a header so a move is self-describing wherever
 * it ends up: a log line, a golden-set fixture, a replayed session. Phase 2 adds a live
 * transport (`master-plan.md` §4.1) and the stamp has to survive that change of channel.
 *
 * Bump the minor when a field is added and the major when an existing one changes meaning.
 */
export const PROTOCOL_VERSION = '1.0.0';

export type ProtocolVersion = typeof PROTOCOL_VERSION;
