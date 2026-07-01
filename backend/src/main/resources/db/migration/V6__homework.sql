-- ===========================================================================
-- Milestone 5: homework + async AI evaluation.
-- ===========================================================================

-- Generic per-user settings (key/value). Used now for the auto-assign toggle. --
CREATE TABLE user_settings (
    id            UUID PRIMARY KEY,
    owner_type    VARCHAR(16) NOT NULL,
    owner_id      UUID NOT NULL,
    setting_key   VARCHAR(64) NOT NULL,
    setting_value VARCHAR(255) NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_user_setting ON user_settings (owner_type, owner_id, setting_key);

-- Homework assignments ------------------------------------------------------
CREATE TABLE homework_assignments (
    id           UUID PRIMARY KEY,
    student_id   UUID NOT NULL REFERENCES students (id),
    topic_id     UUID NOT NULL REFERENCES topics (id),
    assigned_by  VARCHAR(16) NOT NULL DEFAULT 'SYSTEM',
    status       VARCHAR(16) NOT NULL DEFAULT 'ASSIGNED',
    score        INTEGER,
    due_at       TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    evaluated_at TIMESTAMPTZ
);
CREATE INDEX idx_homework_student ON homework_assignments (student_id);
CREATE INDEX idx_homework_student_topic ON homework_assignments (student_id, topic_id);

CREATE TABLE homework_questions (
    id          UUID PRIMARY KEY,
    homework_id UUID NOT NULL REFERENCES homework_assignments (id),
    question_id UUID NOT NULL REFERENCES question_bank (id),
    ordering    INTEGER NOT NULL
);
CREATE INDEX idx_homework_questions_hw ON homework_questions (homework_id);

CREATE TABLE homework_answers (
    id             UUID PRIMARY KEY,
    homework_id    UUID NOT NULL REFERENCES homework_assignments (id),
    question_id    UUID NOT NULL REFERENCES question_bank (id),
    response       TEXT,
    correct        BOOLEAN NOT NULL DEFAULT FALSE,
    partial_credit INTEGER NOT NULL DEFAULT 0,
    feedback       TEXT,
    misconception  TEXT
);
CREATE INDEX idx_homework_answers_hw ON homework_answers (homework_id);

CREATE TABLE ai_evaluations (
    id              UUID PRIMARY KEY,
    homework_id     UUID NOT NULL REFERENCES homework_assignments (id),
    overall_score   INTEGER NOT NULL,
    summary         TEXT,
    recommendations TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_eval_hw ON ai_evaluations (homework_id);

-- HOMEWORK prompt -----------------------------------------------------------
INSERT INTO prompt_templates
    (id, name, category, system_prompt, user_prompt_template,
     model_tier, temperature, max_tokens, json_mode, version, is_active)
VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'HOMEWORK', 'GENERATION',
     'You are Aria, a warm {{subject_name}} tutor for children. You create varied, fair homework that reinforces a topic. You respond with valid JSON only and nothing else.',
     'Generate {{count}} homework questions for the topic "{{topic_name}}" in {{grade_name}} {{subject_name}}.
Learning objectives: {{objectives}}.
Include a mix: a couple of basic questions, one mixed-review question, one word problem, and one challenge question. Vary difficulty from EASY to CHALLENGE.

Return ONLY a JSON object with exactly this shape:
{
  "questions": [
    {
      "type": "MULTIPLE_CHOICE or SHORT_ANSWER",
      "difficulty": "EASY, MEDIUM, HARD, or CHALLENGE",
      "prompt": "the question text",
      "choices": ["four options for MULTIPLE_CHOICE, or an empty list for SHORT_ANSWER"],
      "correctAnswer": "the exact expected answer; for MULTIPLE_CHOICE use the exact option text",
      "solution": "a short step-by-step worked solution a child can follow"
    }
  ]
}',
     'TEACH', 0.6, 3072, TRUE, 1, TRUE);

-- EVALUATION prompt (grades one homework answer) ----------------------------
INSERT INTO prompt_templates
    (id, name, category, system_prompt, user_prompt_template,
     model_tier, temperature, max_tokens, json_mode, version, is_active)
VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'EVALUATION', 'EVALUATION',
     'You are Aria, a kind and fair {{subject_name}} tutor for children. You grade a childs homework answer, giving partial credit when their thinking is partly right, and you explain mistakes gently and clearly without ever being harsh. You respond with valid JSON only and nothing else.',
     'Question: {{question}}
Expected answer: {{expected}}
Worked solution: {{solution}}
The child answered: "{{student_answer}}"

Evaluate the childs answer. Award partial credit when the method is partly correct even if the final answer is wrong.

Return ONLY a JSON object with exactly this shape:
{
  "correct": true or false,
  "partialCredit": a number from 0 to 100,
  "feedback": "a kind, specific explanation of what was right or wrong and how to improve",
  "misconception": "a short tag naming the misunderstanding, or an empty string if there is none"
}',
     'TEACH', 0.3, 1024, TRUE, 1, TRUE);
