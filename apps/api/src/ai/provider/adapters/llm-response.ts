/**
 * The one place an adapter turns vendor values into the port's `LlmResponse`: pricing from the
 * endpoint config, latency as measured by the caller. Each adapter supplies only the vendor's
 * finish-reason mapping, so the cost rule has a single source of truth (CODE-STANDARDS §4).
 */
import { AiError } from '@/ai/provider/errors';
import type { LlmResponse } from '@/ai/provider/types';

/** The values every vendor response reduces to before it becomes an `LlmResponse`. */
export type ResponseValues = {
  text: string;
  tokensIn: number;
  tokensOut: number;
  finishReason: string | null;
  latencyMs: number;
};

/** Accumulates a stream until usage and finish reason have arrived. */
export type StreamAccumulator = {
  text: string;
  tokensIn: number | undefined;
  tokensOut: number | undefined;
  finishReason: string | null;
};

type PricedEndpoint = {
  model: string;
  'cost-per-mtok-in': number;
  'cost-per-mtok-out': number;
};

export function createLlmResponse(
  endpointName: string,
  endpoint: PricedEndpoint,
  values: ResponseValues,
  mapFinishReason: (reason: string | null) => LlmResponse['finishReason'],
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

/** A stream that ended without usage cannot report cost, so it is a content failure. */
export function completeStreamValues(state: StreamAccumulator, latencyMs: number): ResponseValues {
  if (state.tokensIn === undefined || state.tokensOut === undefined) throw new AiError('content');
  return { ...state, tokensIn: state.tokensIn, tokensOut: state.tokensOut, latencyMs };
}
