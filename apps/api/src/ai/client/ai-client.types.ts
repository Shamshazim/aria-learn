import type { PromptInput, PromptName, PromptOutput } from '@/ai/prompts/types';
import type { LlmResponse } from '@/ai/provider';

export type AiRunOptions = Readonly<{
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Internal student id for cost accounting. It is never rendered into the model request. */
  studentId?: string;
}>;

export type AiResult<Name extends PromptName> = Readonly<{
  data: PromptOutput<Name>;
  metadata: LlmResponse & {
    promptName: Name;
    promptVersion: string;
  };
}>;

export type AiClient = Readonly<{
  run<Name extends PromptName>(
    promptName: Name,
    input: PromptInput<Name>,
    options?: AiRunOptions,
  ): Promise<AiResult<Name>>;
}>;
