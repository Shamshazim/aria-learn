import type { Skill } from '@aria/shared';
import { createSkillGraph, type SchedulerSkill, type SkillGraph } from '@aria/tutor';

/**
 * The scheduler's graph over the whole inventory, authored skills and catalogue topics alike.
 * Built once at startup; a prerequisite cycle throws here, before the server listens.
 */
export function schedulerGraph(skills: readonly Skill[]): SkillGraph {
  return createSkillGraph(skills.map(toSchedulerSkill));
}

function toSchedulerSkill(skill: Skill): SchedulerSkill {
  return {
    code: skill.code,
    subject: skill.subject,
    strand: skill.strand,
    band: skill.band,
    prerequisites: skill.prerequisites,
    ...(skill.grade === undefined ? {} : { grade: skill.grade }),
    ...(skill.ordering === undefined ? {} : { ordering: skill.ordering }),
    // P3-07: the authored teaching mode decides; a skill without one (a catalogue topic) falls
    // back to the code, `ADD.FACT.10` being recall without counting (`master-plan.md` §6).
    facts: skill.mode === undefined ? skill.code.includes('.FACT.') : skill.mode === 'fact',
  };
}
