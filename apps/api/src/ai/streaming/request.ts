import { promptRegistry } from '@/ai/prompts/registry';
import type { PromptInput, PromptName } from '@/ai/prompts/types';
import type { LlmRequest } from '@/ai/provider';
import { ValidationError } from '@/errors';

/**
 * A prompt to stream, named rather than rendered (P0-14, P2H-07).
 *
 * The caller says which prompt and what goes in it; what that becomes on the wire is decided
 * here, from the registry, exactly as `ai-client.ts` decides it for a buffered call. That is
 * what keeps `LlmRequest` inside the model layer while a content service can still stream.
 */
export type StreamPrompt<Name extends PromptName = PromptName> = Readonly<{
  name: Name;
  input: PromptInput<Name>;
  /** Internal student id for cost accounting. Never rendered into the request. */
  studentId?: string;
}>;

export function renderStreamRequest<Name extends PromptName>(
  prompt: StreamPrompt<Name>,
): LlmRequest {
  const definition = promptRegistry[prompt.name];
  const parsed = definition.inputSchema.safeParse(prompt.input);
  if (!parsed.success) {
    throw new ValidationError(
      `Input did not match ${prompt.name} prompt version ${definition.version}`,
      parsed.error,
    );
  }
  return {
    tier: definition.tier,
    system: definition.system,
    user: definition.render(parsed.data),
    maxTokens: definition.maxTokens,
    jsonMode: definition.jsonMode,
    accounting: {
      studentId: prompt.studentId,
      promptName: prompt.name,
      promptVersion: definition.version,
    },
  };
}
