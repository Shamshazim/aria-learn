import type { LlmProvider, StreamChunk } from '@/ai/provider';
import { validateMovePlan } from '@/ai/streaming/move-plan';
import { mayStreamBySentence } from '@/ai/streaming/policy';
import { gateSegment } from '@/ai/streaming/segment-gate';
import { SentenceSegmenter } from '@/ai/streaming/segmenter';
import { spokenForm } from '@/ai/streaming/spoken-form';
import type { GatedStreamer, GatedStreamInput, ReleasedSegment } from '@/ai/streaming/types';
import type { QualityGate } from '@/quality';

export const SEGMENT_GATE_BUDGET_MS = 30;

export class MovePlanValidationError extends Error {
  constructor(readonly reasons: readonly string[]) {
    super(`Move plan failed: ${reasons.join(' ')}`);
    this.name = 'MovePlanValidationError';
  }
}

export class StreamGateError extends Error {
  constructor() {
    super('Generated stream and verified fallback both failed the quality gate');
    this.name = 'StreamGateError';
  }
}

export function createGatedStreamer(dependencies: {
  provider: LlmProvider;
  gate: QualityGate;
  now: () => number;
}): GatedStreamer {
  return { stream: (input) => gatedStream(dependencies, input) };
}

async function* gatedStream(
  dependencies: Parameters<typeof createGatedStreamer>[0],
  input: GatedStreamInput,
): AsyncIterable<ReleasedSegment> {
  const planResult = validateMovePlan(input.plan);
  if (!planResult.valid) throw new MovePlanValidationError(planResult.reasons);

  const controller = new AbortController();
  const onAbort = (): void => {
    controller.abort(input.signal?.reason);
  };
  input.signal?.addEventListener('abort', onAbort, { once: true });
  if (input.signal?.aborted === true) onAbort();

  try {
    const chunks = dependencies.provider.stream({ ...input.request, signal: controller.signal });
    if (mayStreamBySentence(input.contentKind)) {
      yield* releaseSentences(dependencies, input, chunks, controller);
    } else {
      yield* releaseWholeItem(dependencies, input, chunks, controller);
    }
  } finally {
    input.signal?.removeEventListener('abort', onAbort);
    controller.abort();
  }
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
