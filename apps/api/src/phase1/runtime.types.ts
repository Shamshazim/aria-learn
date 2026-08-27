import type { AiClient, GatedStreamer, SpendService } from '@/ai';
import type { SecretHasher, ParentTokenVerifier } from '@/auth';
import type { AppConfig } from '@/config';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { Logger } from '@/lib/logger';
import type { TokenGenerator } from '@/lib/tokens';
import type { Metrics } from '@/observability/metrics';
import type { QualityGate } from '@/quality';
import type { ArrivalEventRepository } from '@/repositories/arrival-event.repository';
import type { ContentItemRepository } from '@/repositories/content-item.repository';
import type { LearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import type { MoveOutboxRepository } from '@/repositories/move-outbox.repository';
import type { SafetyFlagRepository } from '@/repositories/safety-flag.repository';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import type { SkillStateRepository } from '@/repositories/skill-state.repository';
import type { StudentRepository } from '@/repositories/student.repository';
import type { SegmentBus } from '@/services/content/segment-bus';

import type { Pool } from 'pg';

export type Phase1RuntimeDeps = Readonly<{
  pool: Pool;
  ai: AiClient;
  spend: SpendService;
  config: AppConfig;
  ids: IdGenerator;
  clock: Clock;
  logger: Logger;
  /**
   * P2H-12: the three ports identity needs. Each defaults to the real one in
   * `identity.runtime.ts`; a test supplies its own so a login is deterministic and fast.
   */
  tokens?: TokenGenerator;
  hasher?: SecretHasher;
  tokenVerifier?: ParentTokenVerifier;
  /** Process-wide counters; supplied by the composition root (P1-14, P2H-02). */
  metrics: Metrics;
  /** P2H-07: builds the sentence streamer once the child-facing gate exists. */
  gatedStreamer?(gate: QualityGate): GatedStreamer;
  /** P2H-07: carries released sentences to whichever request is holding the child's line. */
  segments?: SegmentBus;
  closeVoiceSession?(sessionId: string, at: Date): Promise<void>;
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
  outbox: MoveOutboxRepository;
}>;
