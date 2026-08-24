-- 002 — AI generation cost accounting

CREATE TABLE ai_generation_log (
    id             UUID          PRIMARY KEY,
    student_id     UUID          REFERENCES student (id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    endpoint_name  VARCHAR(64)   NOT NULL,
    model          VARCHAR(128)  NOT NULL,
    tier           VARCHAR(16)   NOT NULL,
    prompt_name    VARCHAR(64),
    prompt_version VARCHAR(16),
    tokens_in      INTEGER       NOT NULL,
    tokens_out     INTEGER       NOT NULL,
    latency_ms     INTEGER       NOT NULL,
    cost_usd       NUMERIC(10,6) NOT NULL DEFAULT 0,
    cached         BOOLEAN       NOT NULL DEFAULT FALSE,
    ok             BOOLEAN       NOT NULL,

    CONSTRAINT ai_generation_tokens_nonnegative CHECK (tokens_in >= 0 AND tokens_out >= 0),
    CONSTRAINT ai_generation_latency_nonnegative CHECK (latency_ms >= 0),
    CONSTRAINT ai_generation_cost_nonnegative CHECK (cost_usd >= 0)
);

CREATE INDEX idx_ai_log_student_day ON ai_generation_log (student_id, created_at);
