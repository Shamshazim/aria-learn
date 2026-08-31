-- 010 — the parts of P0-26 that 009 left open
--
-- Migration 009 attached credentials to the rows 001 established: a parent can be a Supabase
-- user, a child has a secret of their own, and a session is a row so it can be revoked. Four
-- things P0-26 and master-plan.md §12 ask for were not part of that, and each is a promise we
-- currently cannot keep:
--
--   * a device can be trusted without a parent's own account being signed in on it;
--   * a parent's session can be ended, not merely their children's;
--   * consent to collect a child's data is recorded before the child exists;
--   * "delete means delete" survives the vendor call failing halfway.
--
-- Nothing here reshapes what 009 built. Every table below hangs off `parent` or `student` and
-- is read by code that did not exist before it.

-- ── A device a parent trusts, without signing in on it ──────────────────────────────────
--
-- Today a child signs in on a device where their parent's JWT is present, which means a
-- child's tablet carries a parent's full account access — their email, their billing, every
-- other child. A grant is the alternative: the parent authorises the tablet once, from their
-- own phone, and the tablet holds a secret that can do exactly one thing, for exactly the
-- children named in `device_grant_student`.
CREATE TABLE device_grant (
    id           UUID        PRIMARY KEY,
    parent_id    UUID        NOT NULL REFERENCES parent (id) ON DELETE CASCADE,
    -- What the parent calls it in the list they revoke from. "Kitchen iPad", not a fingerprint:
    -- a label a person chose is the only thing that makes a revoke list usable.
    label        TEXT        NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 60),
    -- SHA-256 of a 32-byte random secret, shown once when the grant is created. Not argon2:
    -- nobody chose this, so there is nothing to slow an attacker down about.
    secret_hash  TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX device_grant_secret_key ON device_grant (secret_hash);
CREATE INDEX device_grant_parent_idx ON device_grant (parent_id) WHERE revoked_at IS NULL;

-- Which children this device may open. A row per child rather than a flag on the grant,
-- because "the tablet in the younger one's room" is a real thing a parent wants to say and a
-- grant scoped to the whole family cannot say it.
CREATE TABLE device_grant_student (
    grant_id   UUID NOT NULL REFERENCES device_grant (id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,

    PRIMARY KEY (grant_id, student_id)
);

CREATE INDEX device_grant_student_student_idx ON device_grant_student (student_id);

-- Which device a session was opened from, when it was opened from one at all. Nullable,
-- because a session opened the P2H-12 way — on a device where the parent is signed in — has
-- no grant behind it and never will.
--
-- Without this column, revoking a device cannot end the sessions that device is holding: the
-- session row knows the child and the parent but not the tablet, so the cookie on a lost
-- tablet would keep working until it went idle. That half-hour is exactly what a parent
-- revoking a lost tablet is trying not to wait.
ALTER TABLE child_session
    ADD COLUMN device_grant_id UUID REFERENCES device_grant (id) ON DELETE SET NULL;

CREATE INDEX child_session_grant_idx ON child_session (device_grant_id)
    WHERE revoked_at IS NULL;

-- ── A parent's session, as a row ────────────────────────────────────────────────────────
--
-- 009 verifies a parent's JWT and trusts it until it expires. That is the right check and an
-- incomplete answer: a token we did not mint is a token we cannot take back, so "sign out
-- everywhere" and "this laptop was stolen" have no implementation. The row is keyed on the
-- `session_id` claim Supabase already puts in the token, so no new credential is invented —
-- the vendor still says who you are, and we say for how long.
CREATE TABLE parent_session (
    id                  UUID        PRIMARY KEY,
    parent_id           UUID        NOT NULL REFERENCES parent (id) ON DELETE CASCADE,
    -- The `session_id` claim. Not the subject: one parent may be signed in on three devices,
    -- and revoking the stolen laptop must not sign out the phone.
    provider_session_id TEXT        NOT NULL,
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- The absolute deadline, ours and not the token's. A refreshed vendor token cannot extend
    -- a session past the day it began.
    expires_at          TIMESTAMPTZ NOT NULL,
    revoked_at          TIMESTAMPTZ,

    CONSTRAINT parent_session_expiry_after_issue CHECK (expires_at > issued_at)
);

CREATE UNIQUE INDEX parent_session_provider_key ON parent_session (provider_session_id);
CREATE INDEX parent_session_parent_idx ON parent_session (parent_id) WHERE revoked_at IS NULL;

-- ── Consent, before there is a child to consent about ───────────────────────────────────
--
-- `voice_consent` records agreement to one kind of processing for one child. This is the
-- other consent: the verifiable parental consent COPPA requires *before* a service knowingly
-- collects anything from a child under 13 (master-plan.md §12). It is a precondition of
-- creating a child row, not a checkbox collected afterwards, and it names the version of the
-- disclosure that was actually shown — a consent that cannot say what was agreed to cannot be
-- audited.
CREATE TABLE consent_record (
    id                 UUID        PRIMARY KEY,
    parent_id          UUID        NOT NULL REFERENCES parent (id) ON DELETE CASCADE,
    -- The FTC's approved methods. Text with a CHECK rather than an enum type, matching the
    -- rest of this schema: a new method is a migration either way, and this one reads.
    method             TEXT        NOT NULL CHECK (method IN (
                           'credit_card', 'signed_form', 'video_call',
                           'government_id', 'authorised_school')),
    -- The payment id, the form id, the school agreement. Adult-side by construction — it is
    -- never a fact about the child.
    source_reference   TEXT        CHECK (source_reference IS NULL
                                          OR length(source_reference) BETWEEN 1 AND 200),
    disclosure_version TEXT        NOT NULL CHECK (length(disclosure_version) BETWEEN 1 AND 40),
    granted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Withdrawn, never deleted. A parent who withdraws consent is exercising a right, and the
    -- record that they once gave it is what explains why data existed at all.
    withdrawn_at       TIMESTAMPTZ
);

CREATE INDEX consent_record_parent_idx ON consent_record (parent_id) WHERE withdrawn_at IS NULL;

-- ── Delete means delete, even when the vendor call fails ────────────────────────────────
--
-- Erasing a family touches two systems: our database and the auth provider. Neither can be
-- rolled back once the other has run, so the only honest implementation is a ledger — write
-- the intent, erase locally, delete the vendor's user, mark it done — that a later run can
-- pick up from wherever it stopped (master-plan.md §12.9).
CREATE TABLE deletion_request (
    id               UUID        PRIMARY KEY,
    subject_kind     TEXT        NOT NULL CHECK (subject_kind IN ('child', 'account')),
    -- Deliberately NOT a foreign key, and this is the whole point of the table: the ledger has
    -- to outlive the row it is about. A cascade would erase the evidence that the erasure
    -- happened, which is the one record a regulator would actually ask for.
    subject_id       UUID        NOT NULL,
    parent_id        UUID        NOT NULL,
    -- The Supabase user to hard-delete, for an account. Held here rather than looked up later
    -- because by the time the local rows are gone there is nothing left to look it up from.
    provider_subject TEXT,
    stage            TEXT        NOT NULL CHECK (stage IN (
                         'requested', 'local_deleted', 'complete', 'failed')),
    requested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempts         INTEGER     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    -- Never the vendor's raw response: it can carry an email address.
    last_error       TEXT
);

-- What the replay reads: everything not finished, oldest first.
CREATE INDEX deletion_request_unfinished_idx ON deletion_request (requested_at)
    WHERE stage <> 'complete';
