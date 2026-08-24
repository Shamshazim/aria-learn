/** Maps chat-completions finish reasons onto the port; pricing lives in `llm-response.ts`. */
import { createLlmResponse, type ResponseValues } from '@/ai/provider/adapters/llm-response';
import type { OpenAiCompatibleEndpoint } from '@/ai/provider/adapters/openai-compatible.types';
import type { LlmResponse } from '@/ai/provider/types';

export function createOpenAiLlmResponse(
  endpointName: string,
  endpoint: OpenAiCompatibleEndpoint,
  values: ResponseValues,
): LlmResponse {
  return createLlmResponse(endpointName, endpoint, values, mapFinishReason);
}

/** `null` (no finish chunk arrived) and unknown vendor reasons report `error` rather than guess. */
function mapFinishReason(reason: string | null): LlmResponse['finishReason'] {
  if (reason === 'stop') return 'stop';
  if (reason === 'length') return 'length';
  if (reason === 'content_filter') return 'filtered';
  return 'error';
}
