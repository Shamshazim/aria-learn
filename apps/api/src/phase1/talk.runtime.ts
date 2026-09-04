import type { InventoryService } from '@/curriculum';
import { createWebhookEscalationPort } from '@/safety/crisis/escalation.runtime';
import { createInputSafetyService, type InputSafetyService } from '@/safety/flag.service';
import {
  createMemoryRetrievalService,
  type MemoryRetrievalService,
} from '@/services/memory/retrieve.service';

import type { Phase1Repositories, Phase1RuntimeDeps } from './runtime.types';

/**
 * What a session where Aria talks needs from Phase 1: the curriculum, the child's memory
 * through the scrubber, and the crisis check — the same three the text tutor uses.
 */
export type TalkPorts = Readonly<{
  inventory: Pick<InventoryService, 'getSkill' | 'getLesson'>;
  retrieve: MemoryRetrievalService['retrieve'];
  safety: Pick<InputSafetyService, 'check'>;
}>;

export function buildTalkPorts(
  deps: Phase1RuntimeDeps,
  repositories: Phase1Repositories,
  inventory: InventoryService,
): TalkPorts {
  const memory = createMemoryRetrievalService({
    memory: repositories.memory,
    clock: deps.clock,
    maxTokens: 300,
    recordSize: () => undefined,
  });
  const safety = createInputSafetyService({
    flags: repositories.flags,
    escalation: createWebhookEscalationPort({
      url: deps.config.safeguardingWebhookUrl,
      token: deps.config.safeguardingWebhookToken,
      fetcher: globalThis.fetch,
    }),
    now: () => deps.clock.now(),
  });
  return { inventory, retrieve: (input) => memory.retrieve(input), safety };
}
