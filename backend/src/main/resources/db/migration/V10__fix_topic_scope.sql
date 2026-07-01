-- ===========================================================================
-- Fix: topic 1 ("Multiplying by Single-Digit Numbers") was defined as
-- "multiply a MULTI-DIGIT number by a single-digit number", which overlaps the
-- next (locked) topic "Two-Digit by One-Digit". Redefine topic 1 as genuinely
-- single-digit so each topic has a distinct, increasing scope, and add a scope
-- guard to the generation prompts so content stays within the topic.
-- ===========================================================================

-- Topic 1: true single-digit multiplication facts (single x single).
UPDATE topics
SET name = 'Multiplying Single-Digit Numbers',
    learning_objectives = '["Recall multiplication facts for single-digit numbers","Multiply two single-digit numbers, for example 7 x 8","Understand multiplication as repeated addition"]'
WHERE id = '55555555-5555-5555-5555-555555555555';

-- Topic 2: clarify it is the next step up (two-digit x one-digit).
UPDATE topics
SET learning_objectives = '["Multiply a two-digit number by a one-digit number, for example 34 x 6","Use place value and carrying to multiply","Estimate to check your answer"]'
WHERE id = '55555555-5555-5555-5555-555555555502';

-- Clear cached lessons/examples so every child regenerates within the corrected scope.
DELETE FROM knowledge_articles;
DELETE FROM examples;

-- Add a scope guard so generated content never drifts into other topics.
UPDATE prompt_templates
SET user_prompt_template = replace(
        user_prompt_template,
        'Learning objectives: {{objectives}}.',
        E'Learning objectives: {{objectives}}.\nStay strictly within the scope of THIS topic and these exact objectives. Do not use numbers or skills that belong to a different or later topic.')
WHERE name IN ('KNOWLEDGE', 'EXAMPLES', 'PRACTICE', 'QUIZ', 'HOMEWORK') AND is_active;
