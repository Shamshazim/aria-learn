-- 004 — tutor sessions and arrival history

CREATE TABLE session (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    subject VARCHAR(32) NOT NULL,
    grade VARCHAR(16) NOT NULL,
    band VARCHAR(16) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    end_reason VARCHAR(32),
    next_event_seq INTEGER NOT NULL DEFAULT 1,
    plan JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary TEXT,
    CONSTRAINT session_end_reason_valid CHECK (
      end_reason IS NULL OR end_reason IN ('complete', 'break', 'child_left', 'timeout')
    )
);

CREATE UNIQUE INDEX session_one_open_per_student
    ON session (student_id) WHERE ended_at IS NULL;
CREATE INDEX session_student_started_idx ON session (student_id, started_at DESC);

CREATE TABLE session_event (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES session (id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor VARCHAR(16) NOT NULL CHECK (actor IN ('child', 'aria', 'system')),
    kind VARCHAR(32) NOT NULL,
    text TEXT,
    skill_code VARCHAR(32),
    correct BOOLEAN,
    latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    payload JSONB NOT NULL,
    UNIQUE (session_id, seq)
);

CREATE INDEX session_event_session_seq_idx ON session_event (session_id, seq);

CREATE TABLE arrival_event (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    at TIMESTAMPTZ NOT NULL DEFAULT now(),
    welcome_kind VARCHAR(32) NOT NULL,
    recommendation JSONB,
    accepted BOOLEAN,
    latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0)
);

CREATE INDEX arrival_event_student_at_idx ON arrival_event (student_id, at DESC);
