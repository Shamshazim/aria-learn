/** Maps Messages API stop reasons onto the port; pricing lives in `llm-response.ts`. */
import type { AnthropicProviderOptions } from '@/ai/provider/adapters/anthropic.request';
import { createLlmResponse, type ResponseValues } from '@/ai/provider/adapters/llm-response';
import { AiError } from '@/ai/provider/errors';
import type { LlmResponse } from '@/ai/provider/types';

/** An empty reply is never a populated `LlmResponse` (cloud-model-layer §5.3). */
export function createAnthropicLlmResponse(
  options: AnthropicProviderOptions,
  values: ResponseValues,
): LlmResponse {
  if (values.text === '') throw new AiError('content');
  return createLlmResponse(options.endpointName, options.endpoint, values, mapFinishReason);
}

/**
 * `pause_turn` is a complete, resumable answer, so it counts as `stop`. `tool_use`, `null`
 * and unknown reasons report `error` rather than guess.
 */
function mapFinishReason(reason: string | null): LlmResponse['finishReason'] {
  if (reason === 'end_turn' || reason === 'stop_sequence' || reason === 'pause_turn') return 'stop';
  if (reason === 'max_tokens' || reason === 'model_context_window_exceeded') return 'length';
  if (reason === 'refusal') return 'filtered';
  return 'error';
}
