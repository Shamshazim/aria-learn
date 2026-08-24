-- 003 — verified content cache

CREATE TABLE content_item (
    id               UUID          PRIMARY KEY,
    kind             VARCHAR(32)   NOT NULL,
    skill_code       VARCHAR(32)   NOT NULL,
    band             VARCHAR(16)   NOT NULL,
    body              JSONB         NOT NULL,
    quality_score     NUMERIC(4,3),
    source_model      VARCHAR(128),
    prompt_name       VARCHAR(64),
    prompt_version    VARCHAR(16),
    personalised_for  UUID          REFERENCES student (id) ON DELETE CASCADE,
    verified_at       TIMESTAMPTZ   NOT NULL,
    times_used        INTEGER       NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT content_times_used_nonnegative CHECK (times_used >= 0),
    CONSTRAINT content_quality_range CHECK (
      quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1)
    )
);

CREATE INDEX idx_content_lookup ON content_item (skill_code, band, kind)
WHERE personalised_for IS NULL;

CREATE INDEX idx_content_personalised_lookup
ON content_item (personalised_for, skill_code, band, kind)
WHERE personalised_for IS NOT NULL;
