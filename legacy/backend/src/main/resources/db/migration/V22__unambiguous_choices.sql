-- ===========================================================================
-- Fix: the AI still produced multiple-choice questions where more than one
-- option satisfies the question (e.g. "which number has a 3 in the hundredths
-- place?" when two of the numbers do) or, occasionally, where NO option is
-- correct. The deterministic checker safely defers such ambiguous items rather
-- than guess, so the real fix is to stop generating them. Inject an explicit
-- self-check step into the practice/quiz/homework prompts requiring the model to
-- solve each question and confirm exactly one option is correct before output.
-- ===========================================================================

UPDATE prompt_templates
SET user_prompt_template = replace(
        user_prompt_template,
        'Return ONLY a JSON object with exactly this shape:',
        'ACCURACY (critical): Before you output, solve EACH question yourself and check every option. '
            || 'For a MULTIPLE_CHOICE question exactly one option must be correct and the other three must be '
            || 'definitely wrong — no option may be arguably or partially correct. Watch for "which one has/shows..." '
            || 'questions where more than one option can satisfy the condition (for example, asking which number has '
            || 'a 3 in the hundredths place when two of the numbers do): change the options so that exactly one is '
            || 'correct. Never write a question where none of the options is correct. If a question is ambiguous or you '
            || 'are unsure of its single correct answer, replace it with a clearer one.'
            || E'\n\nReturn ONLY a JSON object with exactly this shape:')
WHERE name IN ('PRACTICE', 'QUIZ', 'HOMEWORK') AND is_active;
