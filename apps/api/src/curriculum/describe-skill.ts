import type { Skill } from '@aria/shared';

/**
 * The skill as a prompt sees it.
 *
 * An authored skill is its name: its note carries the rest. A catalogue topic has no note, so
 * the grade, unit, lesson and legacy objectives go in the prompt instead — they are the whole
 * of what the old app knew about the topic, and the model is asked to write to them.
 */
export function describeSkill(skill: Skill): string {
  if (skill.objectives === undefined || skill.grade === undefined) return skill.name;
  const where = [skill.unit, skill.lesson].filter((part) => part !== undefined).join(' > ');
  const lines = [
    `${skill.name} (grade ${skill.grade}${where === '' ? '' : `, ${where}`})`,
    'Learning objectives:',
    ...skill.objectives.map((objective) => `- ${objective}`),
  ];
  return lines.join('\n');
}
