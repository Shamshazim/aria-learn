import type { Skill } from '@aria/shared';

import type { FallbackDefinition } from '@/content/fallback/fallback.data';

/**
 * The items a catalogue topic can fall back to when nothing can be generated, best first.
 *
 * Each asks the child to say what they already know. That is a question the tutor can always
 * follow up on and one that cannot teach a wrong fact, which is what a fallback nobody has
 * reviewed is allowed to be. The first names the topic; some legacy names ("Multiplying
 * Decimals") are themselves too long a word for the child's band, so the second does not.
 * The objectives stay out of both: they are written for teachers.
 */
export function topicFallbacks(skill: Skill): readonly FallbackDefinition[] {
  if (skill.objectives === undefined) return [];
  return [
    opener(
      skill,
      `Today we look at ${skill.name.toLowerCase()}. Tell me one thing you know about it.`,
    ),
    opener(skill, 'We have a new lesson today. Tell me one thing you know about it already.'),
  ];
}

function opener(skill: Skill, childText: string): FallbackDefinition {
  return {
    skillCode: skill.code,
    kind: 'question',
    gateInput: {
      id: `fallback-${skill.code.toLowerCase().replaceAll('.', '-')}`,
      kind: 'text',
      band: skill.band,
      childText,
      factual: false,
      grounding: 'unsupported',
    },
    body: { prompt: childText, completionOnly: true },
  };
}
