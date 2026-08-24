export type ModelTier = 'TEACH' | 'FAST';

export type LlmRequest = {
  tier: ModelTier;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type LlmResponse = {
  text: string;
  endpointName: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  finishReason: 'stop' | 'length' | 'filtered' | 'error';
};

/** Raw provider streaming stays internal until P0-19 adds sentence-level gating. */
export type StreamChunk =
  { kind: 'text'; text: string } | { kind: 'complete'; response: LlmResponse };

// This is intentionally an interface: provider adapters implement this port.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface LlmProvider {
  complete(request: LlmRequest): Promise<LlmResponse>;
  stream(request: LlmRequest): AsyncIterable<StreamChunk>;
}
