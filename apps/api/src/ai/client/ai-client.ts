import type { AiClient, AiResult, AiRunOptions } from '@/ai/client/ai-client.types';
import { promptRegistry } from '@/ai/prompts/registry';
import type { PromptInput, PromptName, PromptOutput } from '@/ai/prompts/types';
import type { LlmProvider } from '@/ai/provider';
import { ServiceUnavailableError, ValidationError } from '@/errors';
import { isScrubbedContext } from '@/privacy';

import type { ZodType } from 'zod';

export type AiClientDependencies = Readonly<{ provider: LlmProvider }>;

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
  const response = await dependencies.provider.complete({
    tier: definition.tier,
    system: definition.system,
    user: definition.render(parsedInput),
    maxTokens: definition.maxTokens,
    jsonMode: definition.jsonMode,
    ...(options?.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options?.signal === undefined ? {} : { signal: options.signal }),
  });
  const data = parseOutput(definition.outputSchema, response.text, promptName, definition.version);
  return {
    data,
    metadata: { ...response, promptName, promptVersion: definition.version },
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
