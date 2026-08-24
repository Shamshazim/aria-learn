/**
 * The version stamped on every event and move.
 *
 * It travels on the envelope rather than in a header so a move is self-describing wherever
 * it ends up: a log line, a golden-set fixture, a replayed session. Phase 2 adds a live
 * transport (`master-plan.md` §4.1) and the stamp has to survive that change of channel.
 *
 * Bump the minor when a field is added and the major when an existing one changes meaning.
 * Each bump keeps exactly one prior version readable while the new fields stay optional
 * (the P0-27 window), so a scripted source written against the previous version still parses.
 */
export const PROTOCOL_VERSION = '1.1.0';

const PREVIOUS_PROTOCOL_VERSION = '1.0.0';

/** P0-27 keeps one prior wire version readable while its fields remain optional. */
export const SUPPORTED_PROTOCOL_VERSIONS = [PREVIOUS_PROTOCOL_VERSION, PROTOCOL_VERSION] as const;

export type ProtocolVersion = (typeof SUPPORTED_PROTOCOL_VERSIONS)[number];
