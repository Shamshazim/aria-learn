/**
 * The port every hosted-model adapter implements (P0-11, P0-12). Nothing outside `ai/provider/`
 * imports it until P0-13 wires routing; the types are the ticket P0-10 design, verbatim.
 */
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
  accounting?: Readonly<{
    studentId: string | undefined;
    promptName: string;
    promptVersion: string;
  }>;
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
