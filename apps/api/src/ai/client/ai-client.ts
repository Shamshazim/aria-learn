import type { AiClient, AiResult, AiRunOptions } from '@/ai/client/ai-client.types';
import type { AiAccounting, GenerationLogEntry } from '@/ai/cost/cost.types';
import { promptRegistry } from '@/ai/prompts/registry';
import type { PromptInput, PromptName, PromptOutput } from '@/ai/prompts/types';
import type { LlmProvider, LlmRequest, LlmResponse, ModelTier } from '@/ai/provider';
import { ServiceUnavailableError, ValidationError } from '@/errors';
import { isScrubbedContext } from '@/privacy';

import type { ZodType } from 'zod';

export type AiClientDependencies = Readonly<{
  provider: LlmProvider;
  accounting: AiAccounting;
  now: () => number;
}>;

const MAX_CALL_TIMEOUT_MS = 300_000;

export class AiPromptParseError extends ServiceUnavailableError {
  constructor(
    readonly promptName: PromptName,
    readonly promptVersion: string,
  ) {
    super(`Model output did not match ${promptName} prompt version ${promptVersion}`);
  }
}

export class UnscrubbedLearnerContextError extends ValidationError {
  constructor() {
    super('AiClient requires learner context produced by the privacy scrubber');
  }
}

/** Creates the sole model-generation seam used outside the provider module. */
export function createAiClient(dependencies: AiClientDependencies): AiClient {
  return {
    run: (promptName, input, options) => runPrompt(dependencies, promptName, input, options),
  };
}

async function runPrompt<Name extends PromptName>(
  dependencies: AiClientDependencies,
  promptName: Name,
  input: PromptInput<Name>,
  options?: AiRunOptions,
): Promise<AiResult<Name>> {
  assertScrubbedInput(input);
  assertRunOptions(options);
  const definition = promptRegistry[promptName];
  const parsedInput = parseInput(definition.inputSchema, input, promptName, definition.version);
  await dependencies.accounting.assertWithinCap(options?.studentId);
  const response = await completeProvider(dependencies, {
    request: {
      tier: definition.tier,
      system: definition.system,
      user: definition.render(parsedInput),
      maxTokens: definition.maxTokens,
      jsonMode: definition.jsonMode,
      ...(options?.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      ...(options?.signal === undefined ? {} : { signal: options.signal }),
    },
    promptName,
    promptVersion: definition.version,
    studentId: options?.studentId,
  });
  const data = await parseAndRecord(dependencies.accounting, {
    response,
    schema: definition.outputSchema,
    promptName,
    promptVersion: definition.version,
    tier: definition.tier,
    studentId: options?.studentId,
  });
  return { data, metadata: { ...response, promptName, promptVersion: definition.version } };
}

type CallContext = Readonly<{
  request: LlmRequest;
  promptName: PromptName;
  promptVersion: string;
  studentId: string | undefined;
}>;

async function completeProvider(
  dependencies: AiClientDependencies,
  context: CallContext,
): Promise<LlmResponse> {
  const startedAt = dependencies.now();
  try {
    return await dependencies.provider.complete(context.request);
  } catch (error) {
    await dependencies.accounting.record({
      studentId: context.studentId ?? null,
      endpointName: 'routed-provider',
      model: 'unavailable',
      tier: context.request.tier,
      promptName: context.promptName,
      promptVersion: context.promptVersion,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: Math.max(0, dependencies.now() - startedAt),
      costUsd: 0,
      cached: false,
      ok: false,
    });
    throw error;
  }
}

type ParseContext<Name extends PromptName> = Readonly<{
  response: LlmResponse;
  schema: ZodType<PromptOutput<Name>>;
  promptName: Name;
  promptVersion: string;
  tier: ModelTier;
  studentId: string | undefined;
}>;

async function parseAndRecord<Name extends PromptName>(
  accounting: AiAccounting,
  context: ParseContext<Name>,
): Promise<PromptOutput<Name>> {
  let data: PromptOutput<Name>;
  try {
    data = parseOutput(
      context.schema,
      context.response.text,
      context.promptName,
      context.promptVersion,
    );
  } catch (error) {
    await accounting.record(responseEntry(context, false));
    throw error;
  }
  await accounting.record(responseEntry(context, true));
  return data;
}

function responseEntry(
  context: Omit<ParseContext<PromptName>, 'schema'>,
  ok: boolean,
): GenerationLogEntry {
  return {
    studentId: context.studentId ?? null,
    endpointName: context.response.endpointName,
    model: context.response.model,
    tier: context.tier,
    promptName: context.promptName,
    promptVersion: context.promptVersion,
    tokensIn: context.response.tokensIn,
    tokensOut: context.response.tokensOut,
    latencyMs: context.response.latencyMs,
    costUsd: context.response.costUsd,
    cached: false,
    ok,
  };
}

function assertRunOptions(options: AiRunOptions | undefined): void {
  const timeoutMs = options?.timeoutMs;
  if (timeoutMs === undefined) return;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_CALL_TIMEOUT_MS) {
    throw new ValidationError(
      `AI call timeout must be an integer from 1 to ${String(MAX_CALL_TIMEOUT_MS)}`,
    );
  }
}

function parseInput<Name extends PromptName>(
  schema: ZodType<PromptInput<Name>>,
  input: unknown,
  promptName: Name,
  promptVersion: string,
): PromptInput<Name> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      `Input did not match ${promptName} prompt version ${promptVersion}`,
      result.error,
    );
  }
  return result.data;
}

function parseOutput<Name extends PromptName>(
  schema: ZodType<PromptOutput<Name>>,
  text: string,
  promptName: Name,
  promptVersion: string,
): PromptOutput<Name> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new AiPromptParseError(promptName, promptVersion);
  }
  const result = schema.safeParse(value);
  if (!result.success) throw new AiPromptParseError(promptName, promptVersion);
  return result.data;
}

function assertScrubbedInput(input: unknown): void {
  if (!isRecord(input) || !('context' in input) || !isScrubbedContext(input.context)) {
    throw new UnscrubbedLearnerContextError();
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
