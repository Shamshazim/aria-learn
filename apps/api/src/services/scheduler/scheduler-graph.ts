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
    // `ADD.FACT.10`: a skill whose point is recall without counting (`master-plan.md` §6).
    facts: skill.code.includes('.FACT.'),
  };
}
