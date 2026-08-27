-- 009 — identity, completed (P2H-12)
--
-- Migration 001 left the question of credentials open: "P0-26 chooses who issues them, and
-- whatever it chooses attaches to these rows rather than replacing them." P0-26 chose Supabase
-- Auth for adults and Aria-owned rows for children, so this migration attaches both without
-- reshaping anything 001 established.
--
-- Three ideas, in the order they are needed:
--   * a parent row can name the Supabase user it belongs to, so a JWT resolves to a family;
--   * a child has a credential of their own — a PIN, a picture sequence, or neither on a
--     family device — kept away from the profile it authenticates;
--   * a child session is a row, not a claim in a token, so a parent can end one.

-- The link to Supabase. Nullable because a parent row can exist before an account does — the
-- fixtures and the seed data both create parents with no login — and because a family that
-- signs up through some later route must not need this column to be filled in first.
ALTER TABLE parent ADD COLUMN supabase_user_id TEXT;

-- Partial unique, following 001's `parent_email_key`: two parent rows may both have no
-- Supabase user, and no two may claim the same one.
CREATE UNIQUE INDEX parent_supabase_user_id_key
    ON parent (supabase_user_id) WHERE supabase_user_id IS NOT NULL;

-- The parent-editable part of a child's profile: how the name is said, whether it may be
-- spoken at all, and which picture stands for the child in the picker. JSONB rather than three
-- columns because the set is expected to grow with the parent app (P6-01) and every reader
-- parses it through one schema; the repository is the only writer.
ALTER TABLE student ADD COLUMN settings JSONB NOT NULL
    DEFAULT '{"shareFirstName": true, "pronunciation": null, "avatar": "fox"}'::jsonb;

-- Two children in one family may now share a name. Migration 001 forbade it, and gave its
-- reason: "the parent has to be able to tell them apart in the picker, and the child has to
-- recognise their own row." P2H-12 answers that with a picture and a grade instead of a
-- different name, because step-siblings called the same thing are a real family and being
-- refused an account is a worse answer than two foxes being told apart.
DROP INDEX student_parent_display_name_key;

-- What must still be distinct is what the picker actually shows. A child who cannot read
-- finds themselves by their picture, so two children with the same name and the same picture
-- would be one row twice as far as they are concerned.
CREATE UNIQUE INDEX student_parent_name_picture_key
    ON student (parent_id, lower(display_name), (settings ->> 'avatar'));

-- Credentials live beside the student, not on it. Two reasons: every existing SELECT on
-- `student` would otherwise drag a password hash up through the mappers, and the lockout
-- counters are written on failed logins, which is a hot path that has no business touching the
-- profile row.
CREATE TABLE child_credential (
    student_id      UUID        PRIMARY KEY REFERENCES student (id) ON DELETE CASCADE,
    -- argon2id, never the PIN. Null means "this method is not set up", which is distinct from
    -- "wrong": a child with neither hash and no family device cannot sign in at all.
    pin_hash        TEXT,
    -- The picture sequence is hashed the same way. It has ~120 possibilities, so the hash is
    -- not what protects it — the lockout below is. Hashing it anyway means a database dump
    -- does not hand somebody every child's tap order.
    picture_hash    TEXT,
    family_device   BOOLEAN     NOT NULL DEFAULT false,
    failed_attempts INTEGER     NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
    locked_until    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A child session is a row so that it can be revoked. A self-contained token cannot be taken
-- back before it expires, and "a parent can revoke all child sessions" is a requirement.
CREATE TABLE child_session (
    id           UUID        PRIMARY KEY,
    student_id   UUID        NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    -- Both ends of the binding are stored. The cookie is only accepted for the child it was
    -- issued to *and* the parent it was issued under, so a stale cookie on a shared tablet
    -- cannot follow a child into another family's account.
    parent_id    UUID        NOT NULL REFERENCES parent (id) ON DELETE CASCADE,
    -- SHA-256 of the cookie's secret half. The secret is shown once, in the Set-Cookie header,
    -- and never stored: a leaked database cannot mint a session.
    token_hash   TEXT        NOT NULL,
    issued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Idle expiry is server-side. The client's timer is advisory, because a device with a
    -- wrong clock must not be able to extend a session by disagreeing about the time.
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,
    device_label TEXT,

    CONSTRAINT child_session_expiry_after_issue CHECK (expires_at > issued_at)
);

CREATE UNIQUE INDEX child_session_token_hash_key ON child_session (token_hash);
CREATE INDEX child_session_student_idx ON child_session (student_id) WHERE revoked_at IS NULL;
CREATE INDEX child_session_parent_idx ON child_session (parent_id) WHERE revoked_at IS NULL;
-- The sweeper reads this: every live session whose idle or absolute deadline has passed.
CREATE INDEX child_session_live_idx ON child_session (last_seen_at) WHERE revoked_at IS NULL;

-- Who actually clicked, and what they were shown. `parent_id` already said which parent the
-- consent belongs to; on a shared account that is not necessarily the adult who granted it,
-- and the processor map is reworded whenever a vendor or region changes (P2H-08 renamed the
-- voices inside it), so a consent record that does not name its version cannot be audited.
ALTER TABLE voice_consent ADD COLUMN granted_by UUID REFERENCES parent (id) ON DELETE SET NULL;
ALTER TABLE voice_consent ADD COLUMN processor_map_version TEXT;
