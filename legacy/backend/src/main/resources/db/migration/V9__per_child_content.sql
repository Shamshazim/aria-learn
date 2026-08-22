-- ===========================================================================
-- Fix: knowledge articles and worked examples were cached per TOPIC only, so all
-- children shared the same generated lesson/steps. Make them per (student, topic)
-- and personalize generation to each child's level.
-- ===========================================================================

ALTER TABLE knowledge_articles ADD COLUMN student_id UUID;
ALTER TABLE examples ADD COLUMN student_id UUID;

-- Old globally-shared rows are no longer valid; clear so each child regenerates
-- their own personalized version on first access.
DELETE FROM knowledge_articles;
DELETE FROM examples;

CREATE INDEX idx_knowledge_student_topic ON knowledge_articles (student_id, topic_id);
CREATE INDEX idx_examples_student_topic ON examples (student_id, topic_id);

-- Add a personalization note to the KNOWLEDGE and EXAMPLES prompts so the steps are
-- tailored to the individual child's level.
UPDATE prompt_templates
SET user_prompt_template = replace(
        user_prompt_template,
        'Learning objectives: {{objectives}}.',
        E'Learning objectives: {{objectives}}.\nPersonalization note (write specifically for this child): {{learner_note}}')
WHERE name IN ('KNOWLEDGE', 'EXAMPLES') AND is_active;
