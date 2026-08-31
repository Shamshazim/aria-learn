/**
 * What a parent controls beyond their own children (P0-28 gaps on top of P2H-12).
 *
 * Three separate things a parent grants and takes back — a device, their own session, and
 * consent — plus the record of an erasure. None of them carries a child's name: a device is
 * named by the adult who set it up, and the deletion ledger holds ids and nothing else.
 */

/** A tablet a parent trusts, without their own account being signed in on it. */
export type DeviceGrant = Readonly<{
  id: string;
  parentId: string;
  label: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
}>;

/** A grant and the children it may open, for the list a parent revokes from. */
export type DeviceGrantSummary = DeviceGrant & Readonly<{ studentIds: readonly string[] }>;

/**
 * A freshly created grant and the secret that goes onto the device. The secret exists in this
 * shape exactly once, in the response that creates it, and is never readable again.
 */
export type IssuedDeviceGrant = Readonly<{ grant: DeviceGrant; secret: string }>;

/** A parent's session, as a row we can end. Keyed on the vendor's own session id. */
export type ParentSessionRecord = Readonly<{
  id: string;
  parentId: string;
  providerSessionId: string;
  issuedAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}>;

/** The FTC's approved ways of verifying that a real adult agreed. */
export const CONSENT_METHODS = [
  'credit_card',
  'signed_form',
  'video_call',
  'government_id',
  'authorised_school',
] as const;

export type ConsentMethod = (typeof CONSENT_METHODS)[number];

export type ConsentRecord = Readonly<{
  id: string;
  parentId: string;
  method: ConsentMethod;
  /** The payment or agreement id. Adult-side by construction — never a fact about a child. */
  sourceReference: string | null;
  disclosureVersion: string;
  grantedAt: Date;
  withdrawnAt: Date | null;
}>;

export const DELETION_STAGES = ['requested', 'local_deleted', 'complete', 'failed'] as const;

export type DeletionStage = (typeof DELETION_STAGES)[number];

export type DeletionSubjectKind = 'child' | 'account';

/**
 * One erasure, at whatever point it reached. The row outlives its subject on purpose: it is
 * the evidence the erasure happened, and a cascade would delete the proof along with the data.
 */
export type DeletionRequest = Readonly<{
  id: string;
  subjectKind: DeletionSubjectKind;
  subjectId: string;
  parentId: string;
  providerSubject: string | null;
  stage: DeletionStage;
  requestedAt: Date;
  updatedAt: Date;
  attempts: number;
  lastError: string | null;
}>;
