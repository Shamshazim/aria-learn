import type { CorrectionAuthor, CorrectionTarget } from '@aria/shared';

import type { IdGenerator } from '@/lib/ids';
import type { CorrectionTargetRepository } from '@/repositories/correction-target.repository';
import type { FactCorrectionRepository } from '@/repositories/fact-correction.repository';
import type { LearnerEpisodeRepository } from '@/repositories/learner-episode.repository';
import type { LearnerMemoryRepository } from '@/repositories/learner-memory.repository';

export type CorrectionAction = 'retract' | 'replace';

/** What a parent (or the child) asks for. `newValue` is required to replace, refused to retract. */
export type CorrectionRequest = Readonly<{
  targetKind: CorrectionTarget;
  targetId: string;
  action: CorrectionAction;
  newValue?: Readonly<{ text: string }> | undefined;
  reason?: string | undefined;
}>;

export type CorrectionResult = Readonly<{
  /** `unchanged`: the replacement says what the memory already said; nothing was written. */
  status: 'applied' | 'unchanged';
  correctionId: string | null;
  replacementId: string | null;
}>;

/** The repositories a correction writes through, all bound to one transaction. */
export type CorrectionStores = Readonly<{
  facts: LearnerMemoryRepository;
  episodes: LearnerEpisodeRepository;
  corrections: FactCorrectionRepository;
  targets: CorrectionTargetRepository;
}>;

export type ApplyInput = Readonly<{
  studentId: string;
  author: CorrectionAuthor;
  request: CorrectionRequest;
  now: Date;
  ids: IdGenerator;
}>;
