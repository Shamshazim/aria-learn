-- ===========================================================================
-- Milestone 1 schema. Subject-agnostic, multi-grade, soft-delete aware.
-- ===========================================================================

-- Identity ------------------------------------------------------------------
CREATE TABLE parents (
    id            UUID PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(255) NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE students (
    id               UUID PRIMARY KEY,
    parent_id        UUID NOT NULL REFERENCES parents (id),
    username         VARCHAR(255) NOT NULL UNIQUE,
    password_hash    VARCHAR(255) NOT NULL,
    display_name     VARCHAR(255) NOT NULL,
    avatar           VARCHAR(255),
    current_grade_id UUID,
    birth_year       INTEGER,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_parent ON students (parent_id);

-- Curriculum ----------------------------------------------------------------
CREATE TABLE subjects (
    id          UUID PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(255) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE grades (
    id          UUID PRIMARY KEY,
    subject_id  UUID NOT NULL REFERENCES subjects (id),
    name        VARCHAR(255) NOT NULL,
    level_order INTEGER NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_grades_subject ON grades (subject_id);

CREATE TABLE units (
    id        UUID PRIMARY KEY,
    grade_id  UUID NOT NULL REFERENCES grades (id),
    name      VARCHAR(255) NOT NULL,
    ordering  INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_units_grade ON units (grade_id);

CREATE TABLE lessons (
    id        UUID PRIMARY KEY,
    unit_id   UUID NOT NULL REFERENCES units (id),
    name      VARCHAR(255) NOT NULL,
    ordering  INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_lessons_unit ON lessons (unit_id);

CREATE TABLE topics (
    id                  UUID PRIMARY KEY,
    lesson_id           UUID NOT NULL REFERENCES lessons (id),
    name                VARCHAR(255) NOT NULL,
    ordering            INTEGER NOT NULL,
    learning_objectives TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_topics_lesson ON topics (lesson_id);

-- AI prompt management ------------------------------------------------------
CREATE TABLE prompt_templates (
    id                   UUID PRIMARY KEY,
    name                 VARCHAR(255) NOT NULL,
    category             VARCHAR(255) NOT NULL,
    system_prompt        TEXT NOT NULL,
    user_prompt_template TEXT NOT NULL,
    model_tier           VARCHAR(32) NOT NULL DEFAULT 'TEACH',
    temperature          DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    max_tokens           INTEGER NOT NULL DEFAULT 2048,
    json_mode            BOOLEAN NOT NULL DEFAULT TRUE,
    version              INTEGER NOT NULL DEFAULT 1,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prompt_name_active ON prompt_templates (name, is_active);

CREATE TABLE ai_generation_logs (
    id              UUID PRIMARY KEY,
    prompt_name     VARCHAR(255) NOT NULL,
    prompt_version  INTEGER NOT NULL,
    model           VARCHAR(255),
    student_id      UUID,
    tokens_in       INTEGER NOT NULL DEFAULT 0,
    tokens_out      INTEGER NOT NULL DEFAULT 0,
    latency_ms      BIGINT NOT NULL DEFAULT 0,
    repair_attempts INTEGER NOT NULL DEFAULT 0,
    success         BOOLEAN NOT NULL DEFAULT TRUE,
    is_test         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI content ----------------------------------------------------------------
CREATE TABLE knowledge_articles (
    id                          UUID PRIMARY KEY,
    topic_id                    UUID NOT NULL REFERENCES topics (id),
    version                     INTEGER NOT NULL DEFAULT 1,
    body                        TEXT NOT NULL,
    generated_by_prompt_version INTEGER,
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_knowledge_topic ON knowledge_articles (topic_id);

CREATE TABLE question_bank (
    id             UUID PRIMARY KEY,
    topic_id       UUID NOT NULL REFERENCES topics (id),
    type           VARCHAR(32) NOT NULL,
    difficulty     VARCHAR(32) NOT NULL,
    prompt_text    TEXT NOT NULL,
    choices        TEXT,
    correct_answer TEXT NOT NULL,
    solution       TEXT,
    source         VARCHAR(32) NOT NULL DEFAULT 'GENERATED',
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_question_topic ON question_bank (topic_id);
