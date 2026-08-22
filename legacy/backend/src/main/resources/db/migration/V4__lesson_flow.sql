-- ===========================================================================
-- Milestone 3: full lesson flow — examples, guided practice, and quizzes.
-- ===========================================================================

-- Cached worked examples per topic (generated once, reused) ------------------
CREATE TABLE examples (
    id         UUID PRIMARY KEY,
    topic_id   UUID NOT NULL REFERENCES topics (id),
    version    INTEGER NOT NULL DEFAULT 1,
    body       TEXT NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_examples_topic ON examples (topic_id);

-- Quizzes -------------------------------------------------------------------
CREATE TABLE quizzes (
    id             UUID PRIMARY KEY,
    topic_id       UUID NOT NULL REFERENCES topics (id),
    student_id     UUID NOT NULL REFERENCES students (id),
    question_count INTEGER NOT NULL,
    time_limit_sec INTEGER NOT NULL,
    passing_pct    INTEGER NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quizzes_student ON quizzes (student_id);

CREATE TABLE quiz_questions (
    id          UUID PRIMARY KEY,
    quiz_id     UUID NOT NULL REFERENCES quizzes (id),
    question_id UUID NOT NULL REFERENCES question_bank (id),
    ordering    INTEGER NOT NULL
);
CREATE INDEX idx_quiz_questions_quiz ON quiz_questions (quiz_id);

-- Attempts (a single take of a quiz; reused by homework in M5) ---------------
CREATE TABLE attempts (
    id             UUID PRIMARY KEY,
    student_id     UUID NOT NULL REFERENCES students (id),
    activity_type  VARCHAR(32) NOT NULL,
    activity_id    UUID NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status         VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS',
    score_pct      INTEGER,
    passed         BOOLEAN,
    started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at   TIMESTAMPTZ
);
CREATE INDEX idx_attempts_student ON attempts (student_id);
CREATE INDEX idx_attempts_activity ON attempts (activity_type, activity_id);

CREATE TABLE student_answers (
    id             UUID PRIMARY KEY,
    attempt_id     UUID NOT NULL REFERENCES attempts (id),
    question_id    UUID NOT NULL REFERENCES question_bank (id),
    response       TEXT,
    is_correct     BOOLEAN NOT NULL DEFAULT FALSE,
    time_spent_sec INTEGER
);
CREATE INDEX idx_student_answers_attempt ON student_answers (attempt_id);

-- EXAMPLES prompt -----------------------------------------------------------
INSERT INTO prompt_templates
    (id, name, category, system_prompt, user_prompt_template,
     model_tier, temperature, max_tokens, json_mode, version, is_active)
VALUES
    ('88888888-8888-8888-8888-888888888888', 'EXAMPLES', 'GENERATION',
     'You are Aria, a warm and encouraging {{subject_name}} tutor for children. You show fully worked examples, one clear step at a time, in kid-friendly language. You respond with valid JSON only and nothing else.',
     'Create 2 to 3 fully worked examples for the topic "{{topic_name}}" in {{grade_name}} {{subject_name}}.
Learning objectives: {{objectives}}.

Return ONLY a JSON object with exactly this shape:
{
  "examples": [
    {
      "problem": "the example problem",
      "steps": ["each solving step in order, kid-friendly"],
      "answer": "the final answer"
    }
  ]
}',
     'TEACH', 0.5, 2048, TRUE, 1, TRUE);

-- HINT prompt (fast model, low latency) -------------------------------------
INSERT INTO prompt_templates
    (id, name, category, system_prompt, user_prompt_template,
     model_tier, temperature, max_tokens, json_mode, version, is_active)
VALUES
    ('99999999-9999-9999-9999-999999999999', 'HINT', 'TUTORING',
     'You are Aria, a patient and encouraging {{subject_name}} tutor for children. A child is working on a problem and has not solved it yet. You give ONE short, gentle hint that nudges them toward the next step. You NEVER reveal the final answer. You respond with valid JSON only and nothing else.',
     'Problem: {{question}}
The child answered: "{{student_answer}}" which is not correct.
This is hint number {{attempt}}. Make later hints a little more specific, but never give the answer.

Return ONLY a JSON object: { "hint": "one short, encouraging hint that does not reveal the answer" }',
     'FAST', 0.6, 512, TRUE, 1, TRUE);

-- QUIZ prompt ---------------------------------------------------------------
INSERT INTO prompt_templates
    (id, name, category, system_prompt, user_prompt_template,
     model_tier, temperature, max_tokens, json_mode, version, is_active)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'QUIZ', 'GENERATION',
     'You are Aria, a warm {{subject_name}} tutor for children. You write fair, clear quiz questions that check understanding. You respond with valid JSON only and nothing else.',
     'Generate {{count}} quiz questions for the topic "{{topic_name}}" in {{grade_name}} {{subject_name}}.
Learning objectives: {{objectives}}.
Mix MULTIPLE_CHOICE and SHORT_ANSWER. Vary the difficulty from EASY to HARD.

Return ONLY a JSON object with exactly this shape:
{
  "questions": [
    {
      "type": "MULTIPLE_CHOICE or SHORT_ANSWER",
      "difficulty": "EASY, MEDIUM, or HARD",
      "prompt": "the question text",
      "choices": ["four options for MULTIPLE_CHOICE, or an empty list for SHORT_ANSWER"],
      "correctAnswer": "the exact expected answer; for MULTIPLE_CHOICE use the exact option text",
      "solution": "a short step-by-step worked solution a child can follow"
    }
  ]
}',
     'TEACH', 0.6, 3072, TRUE, 1, TRUE);
