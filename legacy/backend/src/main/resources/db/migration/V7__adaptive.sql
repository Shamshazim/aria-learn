-- ===========================================================================
-- Milestone 6: adaptive learning profile.
-- ===========================================================================

CREATE TABLE learning_profiles (
    id                 UUID PRIMARY KEY,
    student_id         UUID NOT NULL REFERENCES students (id),
    accuracy           INTEGER NOT NULL DEFAULT 0,
    mastered_count     INTEGER NOT NULL DEFAULT 0,
    in_progress_count  INTEGER NOT NULL DEFAULT 0,
    confidence         INTEGER NOT NULL DEFAULT 0,
    pace               VARCHAR(32) NOT NULL DEFAULT 'NEW',
    advice             TEXT,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_learning_profile_student ON learning_profiles (student_id);

CREATE TABLE strengths (
    id          UUID PRIMARY KEY,
    student_id  UUID NOT NULL REFERENCES students (id),
    topic_id    UUID NOT NULL REFERENCES topics (id),
    score       INTEGER NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_strengths_student ON strengths (student_id);

CREATE TABLE weaknesses (
    id          UUID PRIMARY KEY,
    student_id  UUID NOT NULL REFERENCES students (id),
    topic_id    UUID NOT NULL REFERENCES topics (id),
    score       INTEGER NOT NULL,
    reason      VARCHAR(64) NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_weaknesses_student ON weaknesses (student_id);

CREATE TABLE mistake_log (
    id            UUID PRIMARY KEY,
    student_id    UUID NOT NULL REFERENCES students (id),
    topic_id      UUID NOT NULL REFERENCES topics (id),
    misconception VARCHAR(255) NOT NULL,
    count         INTEGER NOT NULL DEFAULT 1,
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mistake_student ON mistake_log (student_id);

CREATE TABLE study_recommendations (
    id         UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students (id),
    type       VARCHAR(32) NOT NULL,
    topic_id   UUID REFERENCES topics (id),
    reason     TEXT NOT NULL,
    status     VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recommendations_student ON study_recommendations (student_id);

-- RECOMMENDATION prompt (friendly study advice) -----------------------------
INSERT INTO prompt_templates
    (id, name, category, system_prompt, user_prompt_template,
     model_tier, temperature, max_tokens, json_mode, version, is_active)
VALUES
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'RECOMMENDATION', 'ANALYSIS',
     'You are Aria, a warm and encouraging {{subject_name}} tutor for children. You give short, positive, specific study advice that a child will find motivating. You respond with valid JSON only and nothing else.',
     'Here is a summary of a childs progress in {{subject_name}}:
Strengths: {{strengths}}
Needs work: {{weaknesses}}
Common mistakes: {{mistakes}}

Write 2 to 3 sentences of friendly, motivating advice for this child about what to focus on next. Celebrate the strengths and gently point to what to practice.

Return ONLY a JSON object: { "advice": "your short friendly advice" }',
     'FAST', 0.7, 512, TRUE, 1, TRUE);

-- MASTERY_ANALYSIS prompt (available for deeper analysis; seeded for future use)
INSERT INTO prompt_templates
    (id, name, category, system_prompt, user_prompt_template,
     model_tier, temperature, max_tokens, json_mode, version, is_active)
VALUES
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'MASTERY_ANALYSIS', 'ANALYSIS',
     'You are Aria, a {{subject_name}} tutor. You analyze a childs performance and summarize what they understand well and what to reinforce. You respond with valid JSON only and nothing else.',
     'Progress summary for {{subject_name}}:
{{summary}}

Return ONLY a JSON object: { "analysis": "a concise analysis of strengths and gaps", "focus": "the single most important thing to work on next" }',
     'TEACH', 0.5, 1024, TRUE, 1, TRUE);
