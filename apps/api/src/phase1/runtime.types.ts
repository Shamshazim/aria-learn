import type { AiClient, SpendService } from '@/ai';
import type { AppConfig } from '@/config';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { Logger } from '@/lib/logger';
import type { StudentAccessResolver } from '@/middleware/student-access';
import type { ArrivalEventRepository } from '@/repositories/arrival-event.repository';
import type { ContentItemRepository } from '@/repositories/content-item.repository';
import type { LearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import type { SafetyFlagRepository } from '@/repositories/safety-flag.repository';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import type { SkillStateRepository } from '@/repositories/skill-state.repository';
import type { StudentRepository } from '@/repositories/student.repository';

import type { Pool } from 'pg';

export type Phase1RuntimeDeps = Readonly<{
  pool: Pool;
  ai: AiClient;
  spend: SpendService;
  config: AppConfig;
  ids: IdGenerator;
  clock: Clock;
  logger: Logger;
  access: StudentAccessResolver;
  scheduleBackground?(task: () => Promise<void>): void;
}>;

export type Phase1Repositories = Readonly<{
  students: StudentRepository;
  sessions: SessionRepository;
  events: SessionEventRepository;
  arrivals: ArrivalEventRepository;
  memory: LearnerMemoryRepository;
  skills: SkillStateRepository;
  content: ContentItemRepository;
  flags: SafetyFlagRepository;
}>;
