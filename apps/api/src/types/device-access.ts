/**
 * The child half of the identity domain.
 *
 * A child is not an identity-provider user, so everything here is Aria's own: a parent
 * authorises a device, scopes it to chosen children, and the child opens a session on it by
 * tapping pictures. No type in this file has a field a vendor ever sees.
 */

export type DeviceGrant = {
  id: string;
  parentId: string;
  /** Parent-chosen, so the parent can tell "kitchen tablet" from "school laptop" to revoke it. */
  label: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  /** The children this device may open, and the whole of its authorisation. */
  studentIds: readonly string[];
};

/**
 * A grant at the moment it is created — the only moment its secret exists in plaintext.
 * It is returned once, to the parent, and never stored or logged in this form.
 */
export type IssuedDeviceGrant = {
  grant: DeviceGrant;
  secret: string;
};

export type ChildSession = {
  id: string;
  grantId: string;
  studentId: string;
  createdAt: Date;
  lastSeenAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
};

export type IssuedChildSession = {
  session: ChildSession;
  token: string;
};

/** What the child auth middleware attaches to a request. The student id is never taken from the body. */
export type ChildActor = {
  studentId: string;
  sessionId: string;
  grantId: string;
};

/**
 * A child profile as the picker shows it: a picture and a nickname, and nothing else.
 * Grade, band, history and memory are deliberately absent — the picker runs before anyone
 * has proven who they are.
 */
export type ChildProfileSummary = {
  studentId: string;
  nickname: string;
  avatarKey: string | null;
};
