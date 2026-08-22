-- ===========================================================================
-- Fix: multiple-choice answer keys were sometimes wrong (the local model would
-- mislabel the correct option while generating a batch), so a child's correct
-- pick got marked wrong. We add an ANSWER_VERIFY prompt: a focused, low-temperature
-- solver that re-derives the correct option for each MC question so the stored key
-- can be corrected before it is graded or shown. Also nudges the generators to a
-- lower temperature to reduce arithmetic drift at the source.
-- ===========================================================================

INSERT INTO prompt_templates
    (id, name, category, system_prompt, user_prompt_template,
     model_tier, temperature, max_tokens, json_mode, version, is_active)
VALUES
    ('a1b2c3d4-0000-0000-0000-000000000019', 'ANSWER_VERIFY', 'GENERATION',
     'You are a meticulous answer-key checker for children''s multiple-choice questions in {{subject_name}}. For each question you are given the question text and its answer options. Work out the correct answer yourself, carefully and step by step, WITHOUT trusting any provided key. Then choose the ONE option that is actually correct and copy its text EXACTLY as written, including any label like "A)". You respond with valid JSON only and nothing else.',
     'Check the answer key for these multiple-choice questions. For EACH question, solve it independently step by step, then pick the option that matches your computed answer.

Questions (JSON array of {index, question, choices}):
{{questions_json}}

Return ONLY a JSON object with exactly this shape:
{
  "answers": [
    { "index": 0, "reasoning": "short step-by-step working that leads to the answer", "correctAnswer": "the EXACT text of the correct option, copied from that question''s choices, e.g. B) 2.444" }
  ]
}

Include exactly one entry for every question, keeping the same index. "correctAnswer" MUST be copied character-for-character from that question''s options.',
     'TEACH', 0.0, 2048, TRUE, 1, TRUE);

-- Reduce arithmetic drift in the generators themselves (secondary safeguard).
UPDATE prompt_templates SET temperature = 0.4
 WHERE name IN ('PRACTICE', 'QUIZ', 'HOMEWORK') AND is_active;
