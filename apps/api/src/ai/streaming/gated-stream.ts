import type { AiAccounting, GenerationLogEntry } from '@/ai/cost';
import {
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
  type StreamChunk,
} from '@/ai/provider';
import { validateMovePlan } from '@/ai/streaming/move-plan';
import { mayStreamBySentence } from '@/ai/streaming/policy';
import { gateSegment } from '@/ai/streaming/segment-gate';
import { SentenceSegmenter } from '@/ai/streaming/segmenter';
import { spokenForm } from '@/ai/streaming/spoken-form';
import type { GatedStreamer, GatedStreamInput, ReleasedSegment } from '@/ai/streaming/types';
import { MovePlanValidationError, StreamGateError } from '@/errors';
import type { QualityGate } from '@/quality';

export const SEGMENT_GATE_BUDGET_MS = 30;

export function createGatedStreamer(dependencies: {
  provider: LlmProvider;
  gate: QualityGate;
  now: () => number;
  callNow: () => number;
  accounting: AiAccounting;
}): GatedStreamer {
  return { stream: (input) => gatedStream(dependencies, input) };
}

async function* gatedStream(
  dependencies: Parameters<typeof createGatedStreamer>[0],
  input: GatedStreamInput,
): AsyncIterable<ReleasedSegment> {
  const planResult = validateMovePlan(input.plan, input.contentKind);
  if (!planResult.valid) throw new MovePlanValidationError(planResult.reasons);

  const controller = new AbortController();
  const startedAt = dependencies.callNow();
  let response: LlmResponse | null = null;
  let error: unknown = null;
  let completed = false;
  const onAbort = (): void => {
    controller.abort(input.signal?.reason);
  };
  input.signal?.addEventListener('abort', onAbort, { once: true });
  if (input.signal?.aborted === true) onAbort();

  try {
    const chunks = observeCall(
      dependencies.provider.stream({ ...input.request, signal: controller.signal }),
      (terminal) => {
        response = terminal;
      },
    );
    if (mayStreamBySentence(input.contentKind)) {
      yield* releaseSentences(dependencies, input, chunks, controller);
    } else {
      yield* releaseWholeItem(dependencies, input, chunks, controller);
    }
    completed = true;
  } catch (caught) {
    error = caught;
    throw caught;
  } finally {
    input.signal?.removeEventListener('abort', onAbort);
    controller.abort();
    await dependencies.accounting.record(
      streamEntry(input.request, {
        response,
        error,
        completed,
        measuredLatencyMs: dependencies.callNow() - startedAt,
      }),
    );
  }
}

async function* observeCall(
  chunks: AsyncIterable<StreamChunk>,
  onComplete: (response: LlmResponse) => void,
): AsyncIterable<StreamChunk> {
  for await (const chunk of chunks) {
    if (chunk.kind === 'complete') onComplete(chunk.response);
    yield chunk;
  }
}

function streamEntry(
  request: LlmRequest,
  call: Readonly<{
    response: LlmResponse | null;
    error: unknown;
    completed: boolean;
    measuredLatencyMs: number;
  }>,
): GenerationLogEntry {
  if (call.response === null) return failedStreamEntry(request, call.error, call.measuredLatencyMs);
  return {
    studentId: request.accounting?.studentId ?? null,
    endpointName: call.response.endpointName,
    model: call.response.model,
    tier: request.tier,
    promptName: request.accounting?.promptName ?? null,
    promptVersion: request.accounting?.promptVersion ?? null,
    tokensIn: call.response.tokensIn,
    tokensOut: call.response.tokensOut,
    latencyMs: call.response.latencyMs,
    costUsd: call.response.costUsd,
    cached: false,
    ok: call.completed,
  };
}

function failedStreamEntry(
  request: LlmRequest,
  error: unknown,
  measuredLatencyMs: number,
): GenerationLogEntry {
  return {
    studentId: request.accounting?.studentId ?? null,
    endpointName: endpointFrom(error),
    model: 'unavailable',
    tier: request.tier,
    promptName: request.accounting?.promptName ?? null,
    promptVersion: request.accounting?.promptVersion ?? null,
    tokensIn: 0,
    tokensOut: 0,
    latencyMs: Math.max(0, measuredLatencyMs),
    costUsd: 0,
    cached: false,
    ok: false,
  };
}

function endpointFrom(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('endpointName' in error)) {
    return 'routed-provider';
  }
  return typeof error.endpointName === 'string' ? error.endpointName : 'routed-provider';
}

async function* releaseSentences(
  dependencies: Parameters<typeof createGatedStreamer>[0],
  input: GatedStreamInput,
  chunks: AsyncIterable<StreamChunk>,
  controller: AbortController,
): AsyncIterable<ReleasedSegment> {
  const segmenter = new SentenceSegmenter();
  for await (const chunk of chunks) {
    if (chunk.kind !== 'text') continue;
    for (const sentence of segmenter.push(chunk.text)) {
      const released = releaseOne(dependencies, input, sentence);
      if (released === null) {
        controller.abort();
        yield fallbackSegment(dependencies, input);
        return;
      }
      yield released;
    }
  }
  const remainder = segmenter.flush();
  if (remainder === null) return;
  const released = releaseOne(dependencies, input, remainder);
  if (released !== null) yield released;
  else yield fallbackSegment(dependencies, input);
}

async function* releaseWholeItem(
  dependencies: Parameters<typeof createGatedStreamer>[0],
  input: GatedStreamInput,
  chunks: AsyncIterable<StreamChunk>,
  controller: AbortController,
): AsyncIterable<ReleasedSegment> {
  let written = '';
  for await (const chunk of chunks) {
    if (chunk.kind === 'text') written += chunk.text;
  }
  const released = releaseOne(dependencies, input, written.trim());
  if (released !== null) yield released;
  else {
    controller.abort();
    yield fallbackSegment(dependencies, input);
  }
}

function releaseOne(
  dependencies: Parameters<typeof createGatedStreamer>[0],
  input: GatedStreamInput,
  written: string,
): ReleasedSegment | null {
  const result = gateSegment(dependencies.gate, input.gateInput(written), dependencies.now);
  if (!result.passed) return null;
  return {
    written,
    spoken: spokenForm(written, input.spokenContext),
    gateMs: result.gateMs,
  };
}

function fallbackSegment(
  dependencies: Parameters<typeof createGatedStreamer>[0],
  input: GatedStreamInput,
): ReleasedSegment {
  const released = releaseOne(dependencies, input, input.fallbackText);
  if (released === null) throw new StreamGateError();
  return released;
}
