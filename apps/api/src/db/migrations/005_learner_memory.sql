-- 005 — evidence-backed learner memory

CREATE TABLE learner_fact (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL,
    value JSONB NOT NULL,
    confidence NUMERIC(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    first_observed_at TIMESTAMPTZ NOT NULL,
    last_confirmed_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    sensitivity VARCHAR(16) NOT NULL,
    model_shareable BOOLEAN NOT NULL DEFAULT TRUE,
    superseded_by UUID REFERENCES learner_fact (id) ON DELETE SET NULL
);

CREATE INDEX learner_fact_current_idx
    ON learner_fact (student_id, kind) WHERE superseded_by IS NULL;

CREATE TABLE learner_fact_evidence (
    fact_id UUID NOT NULL REFERENCES learner_fact (id) ON DELETE CASCADE,
    source_kind VARCHAR(32) NOT NULL,
    source_id UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (fact_id, source_kind, source_id)
);

CREATE TABLE observation (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    at TIMESTAMPTZ NOT NULL DEFAULT now(),
    skill_code VARCHAR(32),
    kind VARCHAR(32) NOT NULL,
    note TEXT,
    confidence NUMERIC(3,2) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
    expires_at TIMESTAMPTZ,
    source_event_id UUID REFERENCES session_event (id) ON DELETE SET NULL
);

CREATE INDEX observation_student_at_idx ON observation (student_id, at DESC);
