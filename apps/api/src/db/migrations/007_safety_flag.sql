-- 007 — child-input safety flags and deterministic escalation records

CREATE TABLE safety_flag (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    session_id UUID REFERENCES session (id) ON DELETE CASCADE,
    event_id UUID REFERENCES session_event (id) ON DELETE SET NULL,
    category VARCHAR(32) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    text TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    escalated_at TIMESTAMPTZ,
    escalation_route VARCHAR(32),
    needs_review BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX safety_flag_student_detected_idx ON safety_flag (student_id, detected_at DESC);
