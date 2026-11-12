import type { SkillGraph } from '@aria/tutor';

import type { InventoryService } from '@/curriculum';
import { createMemoryRetrievalService } from '@/services/memory/retrieve.service';
import { createTutorContextLoader, type TutorContextLoader } from '@/services/tutor/context.loader';

import type { MemoryRuntime } from './memory.runtime';
import type { Phase1Repositories, Phase1RuntimeDeps } from './runtime.types';

/** The per-turn context: the session's log, the child's memory and this week's brief. */
export function buildTutorContext(
  deps: Phase1RuntimeDeps,
  repositories: Phase1Repositories,
  curriculum: Readonly<{ inventory: InventoryService; graph: SkillGraph; memory: MemoryRuntime }>,
): TutorContextLoader {
  const { inventory } = curriculum;
  const memory = createMemoryRetrievalService({
    memory: repositories.memory,
    clock: deps.clock,
    maxTokens: 300,
    // P3-03: this week's brief opens the context, ahead of the individual facts.
    brief: (studentId, now) => curriculum.memory.brief.currentForTurn(studentId, now),
    recordSize: () => {
      /* persisted with the move evidence */
    },
  });
  return createTutorContextLoader({
    sessions: repositories.sessions,
    events: repositories.events,
    skills: repositories.skills,
    students: repositories.students,
    graph: curriculum.graph,
    clock: deps.clock,
    retrieve: memory.retrieve,
    misconceptionIds: (skillCode) => inventory.listMisconceptions(skillCode).map((item) => item.id),
    lesson: (skillCode) => inventory.getLesson(skillCode),
    nextTopic: (skillCode) => inventory.nextTopic(skillCode),
  });
}
