/**
 * Who is on the other end of a request (P2H-12).
 *
 * Two actors, and they are never the same one. A parent proves who they are to Supabase and
 * arrives with a JWT; a child proves who they are to us and arrives with a cookie bound to
 * both themselves and their parent. Nothing in this file carries an email: the child-facing
 * routes are typed against these shapes, so a parent's address has nowhere to travel.
 */

/** A parent, as a request sees them once their JWT has been verified. */
export type ParentActor = Readonly<{
  /** Our `parent.id`, not the Supabase subject — everything downstream keys on our row. */
  id: string;
  supabaseUserId: string;
  email: string | null;
}>;

/** How a child signs in on this device. */
export type ChildLoginMethod = 'pin' | 'picture' | 'family-device' | 'none';

export type ChildCredential = Readonly<{
  studentId: string;
  pinHash: string | null;
  pictureHash: string | null;
  familyDevice: boolean;
  failedAttempts: number;
  lockedUntil: Date | null;
}>;

export type ChildSessionRecord = Readonly<{
  id: string;
  studentId: string;
  parentId: string;
  issuedAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  deviceLabel: string | null;
}>;

/** A freshly issued session and the one-time secret that goes into the cookie. */
export type IssuedChildSession = Readonly<{
  session: ChildSessionRecord;
  /** The cookie value. Present exactly once, in the response that issues it. */
  token: string;
}>;

/**
 * Why a child was refused.
 *
 * A child never sees the difference between "wrong" and "locked" as a countdown — the picker
 * shows one fixed sentence for `locked` — but the API has to distinguish them so the log can.
 */
export type ChildLoginFailure = 'wrong' | 'locked' | 'not-configured';
