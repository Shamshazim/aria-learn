import { scrubTextForModel, type ScrubbedContext } from '@/privacy';

export type PromptValues = Readonly<Record<string, string>>;

const PLACEHOLDER = /\{\{([a-z][a-zA-Z0-9]*)\}\}/g;

/** Replaces named placeholders without evaluating or mutating the supplied values. */
export function renderPrompt(
  template: string,
  context: ScrubbedContext,
  values: PromptValues,
): string {
  return template.replace(PLACEHOLDER, (placeholder, key: string) => {
    const value = values[key];
    if (value === undefined) {
      throw new Error(`Missing prompt value for ${placeholder}`);
    }
    return scrubTextForModel(context, value);
  });
}
