-- 008 — adult identity, consent, child profile credentials, device grants and sessions
--
-- P0-26 chose managed Supabase Auth for adults and Aria-owned sessions for children. This
-- migration is that decision as schema. Two properties it has to hold structurally, because
-- neither can be left to a service remembering:
--
--   * A child is never an identity-provider user. Nothing here stores a child email, a child
--     provider subject, or any credential a vendor issued for a child. `adult_identity` is
--     the only table with a `provider_subject`, and it has no path to a student row that is
--     not through the owning parent.
--   * Revocation is a row, not a token expiry. Aria never trusts an unexpired JWT on its own;
--     every session — adult or child — has a row here that can be revoked, and the auth
--     middleware reads it on every request.

-- ── Adults ───────────────────────────────────────────────────────────────────────────────
--
-- 001 left `parent.email` nullable and said so explicitly: it was waiting for this ticket to
-- decide what identifies an account. The answer is the provider subject, and it lives here
-- rather than on `parent` so that a teacher — who owns no children — is the same kind of row.
CREATE TABLE adult_identity (
    id               UUID        PRIMARY KEY,
    role             VARCHAR(16) NOT NULL,
    -- The vendor name is stored, not assumed. rewrite.md §6 keeps self-hosting as a credible
    -- exit; a second value here is what that exit costs.
    provider         VARCHAR(32) NOT NULL,
    -- The vendor's opaque id for this adult. Never an email, never a child's anything.
    provider_subject TEXT        NOT NULL,
    -- Set for a parent and only for a parent: `parent` owns the children, `adult_identity`
    -- owns the credential. A teacher row has no parent_id and therefore no child reachable
    -- from it without an explicit, consented link.
    parent_id        UUID        REFERENCES parent (id) ON DELETE CASCADE,
    -- The FTC age/role gate (rewrite.md §6). A row cannot exist without it: a visitor who
    -- says they are not an adult must leave no persistent identifier behind.
    attested_adult_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT adult_identity_role_valid CHECK (role IN ('parent', 'teacher')),
    CONSTRAINT adult_identity_provider_valid CHECK (provider IN ('supabase', 'fake')),
    CONSTRAINT adult_identity_subject_present CHECK (length(btrim(provider_subject)) > 0),
    CONSTRAINT adult_identity_parent_iff_role CHECK ((role = 'parent') = (parent_id IS NOT NULL))
);

CREATE UNIQUE INDEX adult_identity_subject_key
    ON adult_identity (provider, provider_subject);

-- One adult identity per parent account, so "who is this parent" has exactly one answer.
CREATE UNIQUE INDEX adult_identity_parent_key
    ON adult_identity (parent_id) WHERE parent_id IS NOT NULL;

-- Verifiable parental consent, recorded before any child profile may be created or opened.
-- `source_reference` is the payment or school-agreement id that makes the consent verifiable.
-- It is adult-side data by construction; a child identifier must never be written here.
CREATE TABLE consent_record (
    id               UUID        PRIMARY KEY,
    adult_id         UUID        NOT NULL REFERENCES adult_identity (id) ON DELETE CASCADE,
    method           VARCHAR(32) NOT NULL,
    source_reference TEXT,
    granted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at       TIMESTAMPTZ,

    CONSTRAINT consent_record_method_valid
        CHECK (method IN ('monetary_transaction', 'authorised_school'))
);

CREATE INDEX consent_record_active_idx ON consent_record (adult_id) WHERE revoked_at IS NULL;

-- Aria's record of a live provider session. Aria issues no adult token — Supabase does — but
-- it decides how long that token is honoured and when it stops being honoured. Supabase's own
-- documentation notes a hard-deleted user's access JWT stays valid until it expires; this
-- table is why that does not matter here.
CREATE TABLE adult_session (
    id                  UUID        PRIMARY KEY,
    adult_id            UUID        NOT NULL REFERENCES adult_identity (id) ON DELETE CASCADE,
    -- The `session_id` claim of the provider's access token. Opaque, and not a credential:
    -- knowing it proves nothing without a signed token carrying it.
    provider_session_id TEXT        NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 30 days from creation (rewrite.md §6). Idle expiry is 7 days from `last_seen_at` and is
    -- computed rather than stored, so changing the policy does not require rewriting rows.
    absolute_expires_at TIMESTAMPTZ NOT NULL,
    revoked_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX adult_session_provider_key ON adult_session (provider_session_id);
CREATE INDEX adult_session_adult_idx ON adult_session (adult_id);

-- ── Children ─────────────────────────────────────────────────────────────────────────────
--
-- A child's credential is a picture, because a five-year-old cannot read. `avatar_key` is the
-- picture they recognise themselves by; `picture_secret_hash` is the salted hash of the
-- four-picture sequence they tap. The keyspace is small on purpose — it has to be, for a
-- non-reader — so throttling is part of the credential, not an optional hardening step.
ALTER TABLE student ADD COLUMN avatar_key VARCHAR(32);
ALTER TABLE student ADD COLUMN picture_secret_hash TEXT;
ALTER TABLE student ADD COLUMN failed_secret_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE student ADD COLUMN locked_until TIMESTAMPTZ;

-- A device a parent has authorised, scoped to the children they chose. The secret is stored
-- hashed and shown once; a stolen database gives an attacker no usable device.
CREATE TABLE device_grant (
    id           UUID        PRIMARY KEY,
    parent_id    UUID        NOT NULL REFERENCES parent (id) ON DELETE CASCADE,
    label        TEXT        NOT NULL,
    secret_hash  TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ,

    CONSTRAINT device_grant_label_present CHECK (length(btrim(label)) > 0)
);

CREATE UNIQUE INDEX device_grant_secret_key ON device_grant (secret_hash);
CREATE INDEX device_grant_parent_idx ON device_grant (parent_id, created_at DESC);

-- Which children this device may open. A row here is the whole authorisation: no row, no
-- access, which is what keeps one sibling's device off another sibling's session.
CREATE TABLE device_grant_student (
    grant_id   UUID NOT NULL REFERENCES device_grant (id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,

    PRIMARY KEY (grant_id, student_id)
);

CREATE INDEX device_grant_student_student_idx ON device_grant_student (student_id);

-- A child's live session on an authorised device: 30 minutes idle, four hours absolute.
CREATE TABLE child_session (
    id                  UUID        PRIMARY KEY,
    grant_id            UUID        NOT NULL REFERENCES device_grant (id) ON DELETE CASCADE,
    student_id          UUID        NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    token_hash          TEXT        NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    absolute_expires_at TIMESTAMPTZ NOT NULL,
    revoked_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX child_session_token_key ON child_session (token_hash);
CREATE INDEX child_session_grant_idx ON child_session (grant_id) WHERE revoked_at IS NULL;
CREATE INDEX child_session_student_idx ON child_session (student_id) WHERE revoked_at IS NULL;

-- ── Deletion ─────────────────────────────────────────────────────────────────────────────
--
-- "Delete means delete" (master-plan.md §12.9) spans two systems, so it cannot be one
-- statement. This ledger is the durable half: it records the intent before anything is
-- destroyed and survives the cascade that destroys it, because `subject_id` is deliberately
-- not a foreign key. A restore from backup replays the unfinished rows.
CREATE TABLE deletion_request (
    id               UUID        PRIMARY KEY,
    subject_kind     VARCHAR(16) NOT NULL,
    subject_id       UUID        NOT NULL,
    -- Present only for an adult, and the only reason this table knows a vendor exists: after
    -- the Aria rows are gone there is nothing left to look the subject up from.
    provider         VARCHAR(32),
    provider_subject TEXT,
    stage            VARCHAR(24) NOT NULL,
    attempts         INTEGER     NOT NULL DEFAULT 0,
    last_error       TEXT,
    requested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at     TIMESTAMPTZ,

    CONSTRAINT deletion_request_subject_kind_valid CHECK (subject_kind IN ('child', 'adult')),
    CONSTRAINT deletion_request_stage_valid
        CHECK (stage IN ('requested', 'local_deleted', 'complete', 'failed')),
    CONSTRAINT deletion_request_provider_pair
        CHECK ((provider IS NULL) = (provider_subject IS NULL))
);

-- The replay query: everything not yet finished, oldest first.
CREATE INDEX deletion_request_pending_idx
    ON deletion_request (requested_at) WHERE completed_at IS NULL;
