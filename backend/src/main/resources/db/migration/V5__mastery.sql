-- ===========================================================================
-- Milestone 4: mastery engine + progression gating.
-- ===========================================================================

-- Configurable mastery rules. Scope GLOBAL now; GRADE/TOPIC overrides later. ---
CREATE TABLE mastery_config (
    id                UUID PRIMARY KEY,
    scope             VARCHAR(16) NOT NULL DEFAULT 'GLOBAL',
    scope_id          UUID,
    weight_knowledge  INTEGER NOT NULL,
    weight_practice   INTEGER NOT NULL,
    weight_quiz       INTEGER NOT NULL,
    weight_homework   INTEGER NOT NULL,
    required_pct      INTEGER NOT NULL,
    max_quiz_attempts INTEGER NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_mastery_config_global ON mastery_config (scope) WHERE scope = 'GLOBAL';

-- Per (student, topic) mastery state ----------------------------------------
CREATE TABLE mastery_records (
    id               UUID PRIMARY KEY,
    student_id       UUID NOT NULL REFERENCES students (id),
    topic_id         UUID NOT NULL REFERENCES topics (id),
    knowledge_score  INTEGER,
    practice_correct INTEGER NOT NULL DEFAULT 0,
    practice_total   INTEGER NOT NULL DEFAULT 0,
    quiz_best_score  INTEGER,
    homework_score   INTEGER,
    total_score      INTEGER NOT NULL DEFAULT 0,
    is_mastered      BOOLEAN NOT NULL DEFAULT FALSE,
    achieved_at      TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_mastery_student_topic ON mastery_records (student_id, topic_id);

-- Seed the global default config (weights sum to 100) ------------------------
INSERT INTO mastery_config
    (id, scope, scope_id, weight_knowledge, weight_practice, weight_quiz, weight_homework,
     required_pct, max_quiz_attempts)
VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'GLOBAL', NULL, 20, 30, 20, 30, 80, 3);

-- Extra topics so progression gating is demonstrable -------------------------
INSERT INTO topics (id, lesson_id, name, ordering, learning_objectives, is_active) VALUES
    ('55555555-5555-5555-5555-555555555502',
     '44444444-4444-4444-4444-444444444444',
     'Multiplying Two-Digit by One-Digit Numbers', 2,
     '["Multiply a two-digit number by a one-digit number","Regroup (carry) across place values"]',
     TRUE),
    ('55555555-5555-5555-5555-555555555503',
     '44444444-4444-4444-4444-444444444444',
     'Multiplication Word Problems', 3,
     '["Translate a word problem into a multiplication sentence","Solve and check the answer in context"]',
     TRUE);
