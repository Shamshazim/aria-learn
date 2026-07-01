-- ===========================================================================
-- Fix: open-ended short-answer questions (e.g. "write a sentence with a subject
-- and a predicate") have many valid answers, but were graded by exact-matching a
-- single stored example, so good answers were marked wrong. Add a fast ANSWER_CHECK
-- prompt the grader uses to judge whether a short answer truly satisfies the question.
-- ===========================================================================

INSERT INTO prompt_templates
    (id, name, category, system_prompt, user_prompt_template,
     model_tier, temperature, max_tokens, json_mode, version, is_active)
VALUES
    ('c0c0c0c0-0000-0000-0000-000000000001', 'ANSWER_CHECK', 'EVALUATION',
     'You are Aria, a kind and encouraging {{subject_name}} tutor for children. You check whether a short answer correctly answers a question. Many questions have more than one correct answer, so you judge whether the answer truly satisfies what the question asks, not whether it matches a single example. You respond with valid JSON only and nothing else.',
     'Question: {{question}}
An example of a correct answer: {{expected}}
The child wrote: "{{student_answer}}"

Decide whether the child answer correctly and completely answers the question. Accept ANY answer that genuinely satisfies the question, even if it is different from the example. Be fair and encouraging.

Return ONLY a JSON object: { "correct": true or false, "feedback": "one short, encouraging sentence saying why it is right or what to improve" }',
     'FAST', 0.2, 512, TRUE, 1, TRUE);
