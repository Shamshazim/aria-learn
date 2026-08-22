-- ===========================================================================
-- The fast model judged open answers unreliably (e.g. marked a clearly complete
-- sentence as wrong). Use the stronger teaching model for ANSWER_CHECK and have it
-- reason about the requirement before deciding, so valid answers are accepted.
-- ===========================================================================

UPDATE prompt_templates
SET model_tier = 'TEACH',
    temperature = 0.2,
    user_prompt_template =
'Question: {{question}}
An example of a correct answer: {{expected}}
The child wrote: "{{student_answer}}"

First, state exactly what the question asks for. Then check whether the child answer meets that requirement. Accept ANY answer that genuinely satisfies the question, even if it is shorter, longer, or different from the example. Only mark it wrong if it clearly does NOT answer the question. Be generous and encouraging.

Return ONLY a JSON object: { "correct": true or false, "feedback": "one short, encouraging sentence" }'
WHERE name = 'ANSWER_CHECK' AND is_active;
