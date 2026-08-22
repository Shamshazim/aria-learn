-- ===========================================================================
-- Fix: worked examples on the Examples step could contain wrong steps/answers
-- (the model's arithmetic slips), teaching children the wrong method. We add an
-- EXAMPLE_VERIFY prompt: a focused, low-temperature solver that re-works each
-- example's problem and returns correct steps and a correct final answer, so the
-- displayed solution is right before the child ever sees it.
-- ===========================================================================

INSERT INTO prompt_templates
    (id, name, category, system_prompt, user_prompt_template,
     model_tier, temperature, max_tokens, json_mode, version, is_active)
VALUES
    ('a1b2c3d4-0000-0000-0000-000000000020', 'EXAMPLE_VERIFY', 'GENERATION',
     'You are a meticulous {{subject_name}} solver checking worked examples for children. For each example you are given a problem and its current worked solution. Solve the problem yourself, carefully and step by step, WITHOUT trusting the given solution. Return correct, clear, kid-friendly steps and the correct final answer. Keep the same problem. You respond with valid JSON only and nothing else.',
     'Check and correct these worked examples. For EACH one, solve the problem yourself step by step, then return the correct steps and final answer.

Examples (JSON array of {index, problem, steps, answer}):
{{examples_json}}

Return ONLY a JSON object with exactly this shape:
{
  "examples": [
    { "index": 0, "steps": ["clear step 1", "clear step 2", "..."], "answer": "the correct final answer" }
  ]
}

Keep the SAME problem for each example; only make the steps and the answer correct and consistent with each other. Include exactly one entry for every example, using the same index.',
     'TEACH', 0.0, 2048, TRUE, 1, TRUE);
