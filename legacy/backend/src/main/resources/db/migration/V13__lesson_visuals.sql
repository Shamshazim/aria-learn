-- ===========================================================================
-- Enhancement: lessons now include structured, rendered visuals (not just text).
-- Update the KNOWLEDGE prompt to emit a typed "visuals" array and clear cached
-- lessons so they regenerate with pictures.
-- ===========================================================================

UPDATE prompt_templates
SET user_prompt_template =
'Create a knowledge lesson for the topic "{{topic_name}}" in {{grade_name}} {{subject_name}}.
Learning objectives: {{objectives}}.
Stay strictly within the scope of THIS topic and these objectives. Do not use numbers or skills that belong to a different or later topic.
Personalization note (write specifically for this child): {{learner_note}}

Return ONLY a JSON object with exactly this shape and keys:
{
  "explanation": "a clear, step-by-step, kid-friendly explanation",
  "realWorldExamples": ["2 to 3 short everyday examples"],
  "visuals": [
    {
      "type": "groups | array | numberLine | fractionBar | shape",
      "caption": "a short caption for the picture",
      "groups": 3,
      "itemsPerGroup": 4,
      "emoji": "a single emoji, only for type groups",
      "rows": 3,
      "cols": 4,
      "max": 20,
      "jumps": [0, 4, 8, 12],
      "parts": 4,
      "shaded": 3,
      "shape": "rectangle | square | triangle | circle, only for type shape"
    }
  ],
  "commonMistakes": ["2 to 3 mistakes children often make"],
  "tips": ["2 to 3 short helpful tips"],
  "summary": "one short friendly recap"
}

For "visuals", include 1 to 3 pictures that best show this topic. Choose the type that fits: use "groups" or "array" for multiplication, "numberLine" for counting or addition, "fractionBar" for fractions, "shape" for geometry. Fill in only the fields that your chosen type needs and give each a short caption.'
WHERE name = 'KNOWLEDGE' AND is_active;

-- Regenerate lessons with the new visual format.
DELETE FROM knowledge_articles;
