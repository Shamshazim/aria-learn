-- ===========================================================================
-- Fix: the AI sometimes generated multiple-choice questions with more than one
-- correct option (or "select all that apply"), but the UI is single-select with a
-- single correct answer, so any pick was marked wrong. Require exactly ONE correct
-- option for every multiple-choice question across practice, quizzes, and homework.
-- ===========================================================================

UPDATE prompt_templates
SET user_prompt_template = replace(
        user_prompt_template,
        'four options for MULTIPLE_CHOICE, or an empty list for SHORT_ANSWER',
        'for MULTIPLE_CHOICE provide exactly four options where exactly ONE option is correct and the other three are clearly incorrect (never write a question where more than one option is correct, and never a select-all-that-apply question); for SHORT_ANSWER use an empty list')
WHERE name IN ('PRACTICE', 'QUIZ', 'HOMEWORK') AND is_active;
