-- ===========================================================================
-- Milestone 10: progress reports (with PDF export).
-- ===========================================================================

CREATE TABLE reports (
    id           UUID PRIMARY KEY,
    owner_id     UUID NOT NULL,                       -- parent who generated it
    student_id   UUID NOT NULL REFERENCES students (id),
    scope        VARCHAR(16) NOT NULL,                -- DAILY/WEEKLY/MONTHLY/QUARTERLY/YEARLY
    period_start DATE NOT NULL,
    period_end   DATE NOT NULL,
    data         TEXT NOT NULL,                       -- serialized report JSON
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_student ON reports (student_id);
CREATE INDEX idx_reports_owner ON reports (owner_id);
