-- 008 — consent-gated realtime voice, delivery outbox, reviewed speech assets

CREATE TABLE voice_consent (
    id UUID PRIMARY KEY,
    parent_id UUID NOT NULL REFERENCES parent (id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    status VARCHAR(16) NOT NULL CHECK (status IN ('granted', 'withdrawn')),
    processor_categories TEXT[] NOT NULL,
    retain_reading_audio BOOLEAN NOT NULL DEFAULT false,
    verification_reference VARCHAR(128) NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL,
    withdrawn_at TIMESTAMPTZ,
    UNIQUE (student_id)
);

CREATE TABLE voice_session (
    session_id UUID PRIMARY KEY REFERENCES session (id) ON DELETE CASCADE,
    region VARCHAR(32) NOT NULL,
    connection_epoch INTEGER NOT NULL DEFAULT 0 CHECK (connection_epoch >= 0),
    next_server_seq INTEGER NOT NULL DEFAULT 1 CHECK (next_server_seq > 0),
    processor_map JSONB NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ
);

CREATE TABLE move_outbox (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES session (id) ON DELETE CASCADE,
    server_seq INTEGER NOT NULL CHECK (server_seq > 0),
    move_id VARCHAR(128) NOT NULL,
    generation_id VARCHAR(128),
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at TIMESTAMPTZ,
    UNIQUE (session_id, server_seq),
    UNIQUE (session_id, move_id)
);

CREATE INDEX move_outbox_unacknowledged_idx
    ON move_outbox (session_id, server_seq) WHERE acknowledged_at IS NULL;

CREATE TABLE speech_asset (
    id UUID PRIMARY KEY,
    content_hash VARCHAR(128) NOT NULL,
    voice VARCHAR(64) NOT NULL,
    band VARCHAR(16) NOT NULL,
    purpose VARCHAR(32) NOT NULL,
    intent_bucket VARCHAR(32),
    written_text TEXT NOT NULL,
    spoken_text TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    review_status VARCHAR(16) NOT NULL DEFAULT 'pending'
      CHECK (review_status IN ('pending', 'approved', 'rejected')),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (content_hash, voice)
);

CREATE TABLE retained_child_audio (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES session (id) ON DELETE CASCADE,
    purpose VARCHAR(32) NOT NULL CHECK (purpose = 'parent_reading_review'),
    storage_key TEXT NOT NULL,
    processor_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
    retained_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT retained_audio_expiry_after_creation CHECK (expires_at > retained_at)
);

CREATE INDEX retained_child_audio_expiry_idx
    ON retained_child_audio (expires_at) WHERE deleted_at IS NULL;
