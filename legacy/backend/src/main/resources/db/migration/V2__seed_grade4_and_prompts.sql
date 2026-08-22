-- ===========================================================================
-- Milestone 1 seed data: Mathematics > Grade 4 > one unit/lesson/topic,
-- plus the KNOWLEDGE and PRACTICE prompt templates (Aria persona).
-- Curriculum is data, never hardcoded in logic; this is just the starting set.
-- ===========================================================================

-- Subject -------------------------------------------------------------------
INSERT INTO subjects (id, name, slug, description, is_active) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Mathematics', 'math',
     'Elementary and middle school mathematics', TRUE);

-- Grade ---------------------------------------------------------------------
INSERT INTO grades (id, subject_id, name, level_order, is_active) VALUES
    ('22222222-2222-2222-2222-222222222222',
     '11111111-1111-1111-1111-111111111111', 'Grade 4', 4, TRUE);

-- Unit ----------------------------------------------------------------------
INSERT INTO units (id, grade_id, name, ordering, is_active) VALUES
    ('33333333-3333-3333-3333-333333333333',
     '22222222-2222-2222-2222-222222222222', 'Multiplication', 1, TRUE);

-- Lesson --------------------------------------------------------------------
INSERT INTO lessons (id, unit_id, name, ordering, is_active) VALUES
    ('44444444-4444-4444-4444-444444444444',
     '33333333-3333-3333-3333-333333333333', 'Multiplying Whole Numbers', 1, TRUE);

-- Topic ---------------------------------------------------------------------
INSERT INTO topics (id, lesson_id, name, ordering, learning_objectives, is_active) VALUES
    ('55555555-5555-5555-5555-555555555555',
     '44444444-4444-4444-4444-444444444444',
     'Multiplying by Single-Digit Numbers', 1,
     '["Multiply a multi-digit number by a single-digit number","Use place value to multiply","Check answers using estimation"]',
     TRUE);

-- KNOWLEDGE prompt ----------------------------------------------------------
INSERT INTO prompt_templates
    (id, name, category, system_prompt, user_prompt_template,
     model_tier, temperature, max_tokens, json_mode, version, is_active)
VALUES
    ('66666666-6666-6666-6666-666666666666', 'KNOWLEDGE', 'GENERATION',
     'You are Aria, a warm, patient, and encouraging {{subject_name}} tutor for children. You explain ideas simply and clearly, in a friendly voice, using kid-friendly language and concrete everyday examples. You never overwhelm a child. You respond with valid JSON only and nothing else.',
     'Create a knowledge lesson for the topic "{{topic_name}}" in {{grade_name}} {{subject_name}}.
Learning objectives: {{objectives}}.

Return ONLY a JSON object with exactly this shape and keys:
{
  "explanation": "a clear, step-by-step, kid-friendly explanation",
  "realWorldExamples": ["2 to 3 short everyday examples"],
  "visualIdeas": ["2 to 3 ideas for a helpful picture or diagram"],
  "commonMistakes": ["2 to 3 mistakes children often make"],
  "tips": ["2 to 3 short helpful tips"],
  "summary": "one short friendly recap"
}',
     'TEACH', 0.7, 2048, TRUE, 1, TRUE);

-- PRACTICE prompt -----------------------------------------------------------
INSERT INTO prompt_templates
    (id, name, category, system_prompt, user_prompt_template,
     model_tier, temperature, max_tokens, json_mode, version, is_active)
VALUES
    ('77777777-7777-7777-7777-777777777777', 'PRACTICE', 'GENERATION',
     'You are Aria, a warm and encouraging {{subject_name}} tutor for children. You write clear, age-appropriate practice questions. You respond with valid JSON only and nothing else.',
     'Generate {{count}} {{difficulty}} practice questions for the topic "{{topic_name}}" in {{grade_name}} {{subject_name}}.
Learning objectives: {{objectives}}.
Use a mix of MULTIPLE_CHOICE and SHORT_ANSWER questions.

Return ONLY a JSON object with exactly this shape:
{
  "questions": [
    {
      "type": "MULTIPLE_CHOICE or SHORT_ANSWER",
      "difficulty": "{{difficulty}}",
      "prompt": "the question text",
      "choices": ["four options for MULTIPLE_CHOICE, or an empty list for SHORT_ANSWER"],
      "correctAnswer": "the exact expected answer; for MULTIPLE_CHOICE use the exact option text",
      "solution": "a short step-by-step worked solution a child can follow"
    }
  ]
}',
     'TEACH', 0.6, 3072, TRUE, 1, TRUE);
