import type { AiClient } from '@/ai';
import {
  createContentCacheService,
  createFallbackService,
  createReliableContentService,
  type GeneratedContent,
} from '@/content';
import type { InventoryService } from '@/curriculum';
import { ServiceUnavailableError } from '@/errors';
import { scrubLearnerContext } from '@/privacy';
import { createQualityGate } from '@/quality';
import { isUnsafeChildFacingText } from '@/safety/crisis/detect';
import { createAheadService } from '@/services/content/ahead.service';
import { contentScope } from '@/services/content/personalise';

import type { Phase1Repositories, Phase1RuntimeDeps } from './runtime.types';

export type ContentServices = Readonly<{
  gate: ReturnType<typeof createQualityGate>;
  reliable: ReturnType<typeof createReliableContentService>;
  ahead: ReturnType<typeof createAheadService>;
}>;

export function buildContentServices(
  deps: Phase1RuntimeDeps,
  repositories: Phase1Repositories,
  inventory: InventoryService,
): ContentServices {
  const gate = createQualityGate((text) => outputSafety(text));
  const fallback = createFallbackService({ inventory, gate });
  const cache = createContentCacheService({
    repository: repositories.content,
    accounting: deps.spend,
  });
  const reliable = createReliableContentService({
    cache,
    fallback,
    gate,
    generate: (input, signal) => generatePractice(deps.ai, inventory, input, signal),
    recordFailure: (verdict) => {
      deps.logger.warn(
        { checks: verdict.reasons.map((reason) => reason.code) },
        'Generated content failed the quality gate',
      );
      return Promise.resolve();
    },
  });
  const ahead = createAheadService({
    prepare: async (request: Parameters<typeof reliable.resolve>[0], signal) => {
      if (!signal.aborted) await reliable.resolve(request, signal);
    },
    onError: (error, sessionId) => {
      deps.logger.warn({ err: error, sessionId }, 'Ahead content generation failed');
    },
  });
  return { gate, reliable, ahead };
}

async function generatePractice(
  ai: AiClient,
  inventory: InventoryService,
  input: Parameters<ContentServices['reliable']['resolve']>[0],
  signal?: AbortSignal,
): Promise<GeneratedContent> {
  const skill = inventory.getSkill(input.skillCode);
  if (skill === null || skill.subject === 'arithmetic')
    throw new ServiceUnavailableError('use verified arithmetic fallback');
  const context = scrubLearnerContext(
    { identifiers: {}, gradeBand: input.band, skill: skill.code },
    { pseudonym: 'omit' },
  );
  const result = await ai.run(
    'practice-item',
    { context, skill: skill.name, difficulty: 'same' },
    { studentId: input.studentId, ...(signal === undefined ? {} : { signal }) },
  );
  const body = {
    prompt: result.data.prompt,
    answerKey: result.data.answer,
    ...(result.data.options === undefined
      ? {}
      : { choices: result.data.options.map((option) => option.text) }),
  };
  return {
    gateInput: {
      id: `generated-${skill.code}`,
      kind: 'text',
      band: input.band,
      childText: result.data.prompt,
      factual: false,
      grounding: 'unsupported',
    },
    draft: {
      kind: input.kind,
      skillCode: skill.code,
      band: input.band,
      body,
      sourceModel: result.metadata.model,
      promptName: result.metadata.promptName,
      promptVersion: result.metadata.promptVersion,
      scope: contentScope({ studentId: input.studentId, usesLearnerMemory: false }),
    },
  };
}

function outputSafety(text: string): Readonly<{ safe: boolean; categories: readonly string[] }> {
  const unsafe = isUnsafeChildFacingText(text);
  return { safe: !unsafe, categories: unsafe ? ['blocked-output'] : [] };
}
