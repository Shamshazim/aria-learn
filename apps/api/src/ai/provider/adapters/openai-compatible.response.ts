/** Turns parsed vendor values into the port's `LlmResponse`, pricing from the endpoint config. */
import type {
  OpenAiCompatibleEndpoint,
  ResponseValues,
} from '@/ai/provider/adapters/openai-compatible.types';
import type { LlmResponse } from '@/ai/provider/types';

export function createOpenAiLlmResponse(
  endpointName: string,
  endpoint: OpenAiCompatibleEndpoint,
  values: ResponseValues,
): LlmResponse {
  return {
    text: values.text,
    endpointName,
    model: endpoint.model,
    tokensIn: values.tokensIn,
    tokensOut: values.tokensOut,
    costUsd:
      (values.tokensIn * endpoint['cost-per-mtok-in'] +
        values.tokensOut * endpoint['cost-per-mtok-out']) /
      1_000_000,
    latencyMs: values.latencyMs,
    finishReason: mapFinishReason(values.finishReason),
  };
}

/** `null` (no finish chunk arrived) and unknown vendor reasons report `error` rather than guess. */
function mapFinishReason(reason: string | null): LlmResponse['finishReason'] {
  if (reason === 'stop') return 'stop';
  if (reason === 'length') return 'length';
  if (reason === 'content_filter') return 'filtered';
  return 'error';
}
