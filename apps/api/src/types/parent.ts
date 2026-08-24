/**
 * A parent account, as the rest of the service sees it: camelCase, `Date`, no row shape.
 *
 * Credentials are absent by design. P0-26 decides how a parent proves who they are, and
 * whatever it decides attaches to this row rather than reshaping it.
 */
export type Parent = {
  id: string;
  /** Null until an address is attached — see the note on `parent.email` in migration 001. */
  email: string | null;
  displayName: string;
  createdAt: Date;
};

/** What a caller supplies. The id and `createdAt` are not theirs to choose. */
export type NewParent = {
  email: string | null;
  displayName: string;
};
