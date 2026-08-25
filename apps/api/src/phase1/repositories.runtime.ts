import { createArrivalEventRepository } from '@/repositories/arrival-event.repository';
import { createContentItemRepository } from '@/repositories/content-item.repository';
import { createLearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import { createSafetyFlagRepository } from '@/repositories/safety-flag.repository';
import { createSessionEventRepository } from '@/repositories/session-event.repository';
import { createSessionRepository } from '@/repositories/session.repository';
import { createSkillStateRepository } from '@/repositories/skill-state.repository';
import { createStudentRepository } from '@/repositories/student.repository';

import type { Phase1Repositories, Phase1RuntimeDeps } from './runtime.types';

export function buildRepositories(deps: Phase1RuntimeDeps): Phase1Repositories {
  return {
    students: createStudentRepository({ db: deps.pool, ids: deps.ids }),
    sessions: createSessionRepository({ db: deps.pool, ids: deps.ids }),
    events: createSessionEventRepository({ db: deps.pool, ids: deps.ids, clock: deps.clock }),
    arrivals: createArrivalEventRepository({ db: deps.pool, ids: deps.ids, clock: deps.clock }),
    memory: createLearnerMemoryRepository({ db: deps.pool, ids: deps.ids }),
    skills: createSkillStateRepository({ db: deps.pool, clock: deps.clock }),
    content: createContentItemRepository({ db: deps.pool, ids: deps.ids, clock: deps.clock }),
    flags: createSafetyFlagRepository({ db: deps.pool, ids: deps.ids, clock: deps.clock }),
  };
}
