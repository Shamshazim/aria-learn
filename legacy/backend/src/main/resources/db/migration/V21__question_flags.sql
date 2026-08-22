-- ===========================================================================
-- "Report this question": lets a student flag a question that looks wrong or
-- confusing so a parent can review it. A safety net for the rare case the AI
-- answer key or wording is still off despite verification.
-- ===========================================================================

CREATE TABLE question_flags (
    id          UUID PRIMARY KEY,
    question_id UUID NOT NULL REFERENCES question_bank(id),
    student_id  UUID NOT NULL,
    reason      TEXT,
    resolved    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_question_flags_student ON question_flags (student_id);
CREATE INDEX idx_question_flags_open ON question_flags (resolved);
