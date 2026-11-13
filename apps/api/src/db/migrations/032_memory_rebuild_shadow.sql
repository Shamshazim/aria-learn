-- 032 — P3-02: rebuilding memory from the raw log, into a shadow set
--
-- P3-02 reserved 011 for this. The runner refuses a migration numbered behind one already
-- applied, so it takes the next free number (see the P3-01 ticket's Status).
--
-- `master-plan.md` §4.2: memory is "periodically rebuilt from the raw log so summary drift can
-- be detected". A rebuild re-derives facts and episodes from `session_event` into these
-- tables, never into the live ones; comparing the two is the drift report. Promoting a shadow
-- set is a manual, logged action that is not built here.
--
-- Every table cascades from `student`, so erasing a child erases their rebuilds too.

CREATE TABLE IF NOT EXISTS memory_rebuild_run (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    -- |symmetric difference| / |union| over (kind, normalised value); 0 is no drift.
    drift_score NUMERIC(5,4) CHECK (drift_score IS NULL OR drift_score BETWEEN 0 AND 1),
    report JSONB
);
CREATE INDEX IF NOT EXISTS memory_rebuild_run_student_idx
    ON memory_rebuild_run (student_id, started_at DESC);

-- The shadow rows carry what the comparison needs, not every live column: no foreign keys to
-- `skill` or `session`, because a shadow set must survive a skill leaving the inventory.
CREATE TABLE IF NOT EXISTS learner_fact_shadow (
    rebuild_run_id UUID NOT NULL REFERENCES memory_rebuild_run (id) ON DELETE CASCADE,
    id UUID NOT NULL,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL,
    value JSONB NOT NULL,
    confidence NUMERIC(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    first_observed_at TIMESTAMPTZ NOT NULL,
    last_confirmed_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    corrected BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (rebuild_run_id, id)
);

CREATE TABLE IF NOT EXISTS learner_episode_shadow (
    rebuild_run_id UUID NOT NULL REFERENCES memory_rebuild_run (id) ON DELETE CASCADE,
    id UUID NOT NULL,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    at TIMESTAMPTZ NOT NULL,
    kind VARCHAR(32) NOT NULL,
    summary TEXT NOT NULL,
    importance NUMERIC(3,2) NOT NULL CHECK (importance BETWEEN 0 AND 1),
    skill_code VARCHAR(32),
    source_session_id UUID NOT NULL,
    expires_at TIMESTAMPTZ,
    PRIMARY KEY (rebuild_run_id, id)
);
