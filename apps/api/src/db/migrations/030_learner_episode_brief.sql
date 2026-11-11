-- 030 — episodes, briefs, correction history (P3-01)
--
-- Numbered 030, not the 010 the ticket reserved: 010 was taken by identity work, and the
-- runner refuses a migration numbered behind one already applied (028 is on main, 029 is in
-- review). Every table cascades from `student`, so child erasure (P6-06) removes all of it.
--
-- The CHECK lists duplicate vocabularies from `@aria/shared` (memory/*). The database has to
-- defend itself against any writer; `memory-vocabulary.test.ts` fails if the copies diverge.

CREATE TABLE IF NOT EXISTS learner_episode (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    at TIMESTAMPTZ NOT NULL,
    kind VARCHAR(32) NOT NULL,
    summary TEXT NOT NULL,
    importance NUMERIC(3,2) NOT NULL CHECK (importance BETWEEN 0 AND 1),
    skill_code VARCHAR(32) REFERENCES skill (code) ON DELETE SET NULL,
    source_session_id UUID NOT NULL REFERENCES session (id) ON DELETE CASCADE,
    sensitivity VARCHAR(16) NOT NULL,
    model_shareable BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    superseded_by UUID REFERENCES learner_episode (id) ON DELETE SET NULL,
    CONSTRAINT learner_episode_kind_valid CHECK (
      kind IN ('breakthrough', 'struggle', 'preference_change', 'return_after_absence',
               'goal_reached', 'other')
    ),
    CONSTRAINT learner_episode_summary_present CHECK (length(btrim(summary)) > 0)
);

CREATE INDEX IF NOT EXISTS learner_episode_student_at_idx
    ON learner_episode (student_id, at DESC) WHERE superseded_by IS NULL;

CREATE TABLE IF NOT EXISTS learner_episode_evidence (
    episode_id UUID NOT NULL REFERENCES learner_episode (id) ON DELETE CASCADE,
    source_kind VARCHAR(32) NOT NULL,
    source_id UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (episode_id, source_kind, source_id),
    CONSTRAINT learner_episode_evidence_source_valid CHECK (
      source_kind IN ('session_event', 'oral_reading', 'child_writing')
    )
);

-- `hasEvidence(sourceKind, sourceId)` looks evidence up by its source, not its episode.
CREATE INDEX IF NOT EXISTS learner_episode_evidence_source_idx
    ON learner_episode_evidence (source_kind, source_id);

CREATE TABLE IF NOT EXISTS learner_brief (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    period VARCHAR(8) NOT NULL,
    period_start DATE NOT NULL,
    version INTEGER NOT NULL CHECK (version >= 1),
    written_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    body TEXT NOT NULL,
    evidence_snapshot JSONB NOT NULL,
    generator VARCHAR(64) NOT NULL,
    superseded_by UUID REFERENCES learner_brief (id) ON DELETE SET NULL,
    UNIQUE (student_id, period, period_start, version),
    CONSTRAINT learner_brief_period_valid CHECK (period IN ('week', 'month', 'year'))
);

CREATE INDEX IF NOT EXISTS learner_brief_current_idx
    ON learner_brief (student_id, period, period_start) WHERE superseded_by IS NULL;

CREATE TABLE IF NOT EXISTS learner_fact_correction (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    target_kind VARCHAR(16) NOT NULL,
    target_id UUID NOT NULL,
    replacement_id UUID,
    corrected_by VARCHAR(16) NOT NULL,
    corrected_by_id UUID,
    old_value JSONB NOT NULL,
    new_value JSONB,
    reason TEXT,
    at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT learner_fact_correction_target_valid CHECK (target_kind IN ('fact', 'episode')),
    CONSTRAINT learner_fact_correction_author_valid CHECK (
      corrected_by IN ('parent', 'child', 'staff')
    ),
    -- A parent is always identified; a child never is.
    CONSTRAINT learner_fact_correction_author_identity CHECK (
      (corrected_by <> 'parent' OR corrected_by_id IS NOT NULL)
      AND (corrected_by <> 'child' OR corrected_by_id IS NULL)
    ),
    -- Either a replacement carrying the new value, or a retraction with neither.
    CONSTRAINT learner_fact_correction_replacement_has_value CHECK (
      (replacement_id IS NULL) = (new_value IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS learner_fact_correction_student_idx
    ON learner_fact_correction (student_id, at DESC);
