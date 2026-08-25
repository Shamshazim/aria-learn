/** Public model-generation seam; provider and prompt internals stay private to this module. */
export {
  AiPromptParseError,
  createAiClient,
  UnscrubbedLearnerContextError,
} from '@/ai/client/ai-client';
export type { AiClientDependencies } from '@/ai/client/ai-client';
export type { AiClient, AiResult, AiRunOptions } from '@/ai/client/ai-client.types';
export { createSpendService, SpendCapExceededError } from '@/ai/cost';
export type {
  AiAccounting,
  GenerationLogEntry,
  SpendAlert,
  SpendReport,
  SpendService,
  SpendSummary,
} from '@/ai/cost';
export type { PromptInput, PromptName, PromptOutput } from '@/ai/prompts/types';
export {
  createGatedStreamer,
  createRespondStreamer,
  MovePlanValidationError,
  SEGMENT_GATE_BUDGET_MS,
  spokenForm,
  StreamGateError,
  validateMovePlan,
} from '@/ai/streaming';
export type {
  GatedSegment,
  GatedStreamer,
  GatedStreamInput,
  RespondStreamer,
  RespondStreamInput,
  MovePlan,
  MovePlanResult,
  ReleasedSegment,
  SpokenContext,
  StreamContentKind,
} from '@/ai/streaming';
