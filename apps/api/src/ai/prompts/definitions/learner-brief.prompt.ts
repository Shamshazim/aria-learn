import { z } from 'zod';

import { scrubbedContextSchema } from '@/ai/prompts/input.schema';
import { renderPrompt } from '@/ai/prompts/render/render';
import type {
  LearnerBriefPromptInput,
  LearnerBriefPromptOutput,
  PromptDefinition,
} from '@/ai/prompts/types';

/** How the learner is named in the output; the API puts the first name back afterwards. */
export const BRIEF_CHILD_TOKEN = '[child]';

const TEMPLATE = `Write a short paragraph for a parent about their child's {{period}} with Aria, their tutor.

Use only the evidence below. Each item has a reference in square brackets.
Sessions this {{period}}: {{sessions}}
Remembered facts:
{{facts}}
Moments worth noting:
{{episodes}}
Skills practised (standing, never a score):
{{skills}}
{{avoid}}
Rules:
- Refer to the child only as ${BRIEF_CHILD_TOKEN}. Never invent a name.
- Describe what happened and what the child chose; never judge them. No labels ("gifted",
  "slow", "lazy", "behind"), no diagnoses, no percentages, scores, grade letters or IQ.
- Use skill names as written; never a code.
- At most {{wordCap}} words in total. Warm, plain, specific.
- Every sentence lists the references it rests on. A sentence with no reference is not allowed.

Return JSON with one field, "sentences": an array of objects with exactly the fields
"text" (one sentence) and "refs" (an array of the references it uses, copied exactly).`;

const itemSchema = z
  .object({ ref: z.string().min(1).max(8), text: z.string().min(1).max(500) })
  .strict();

const inputSchema: z.ZodType<LearnerBriefPromptInput> = z
  .object({
    context: scrubbedContextSchema,
    period: z.enum(['week', 'month', 'year']),
    wordCap: z.number().int().positive().max(400),
    sessions: z.number().int().nonnegative(),
    facts: z.array(itemSchema).max(32),
    episodes: z.array(itemSchema).max(32),
    skills: z
      .array(
        z
          .object({
            ref: z.string().min(1).max(8),
            name: z.string().min(1).max(200),
            standing: z.enum(['new', 'practising', 'strong']),
          })
          .strict(),
      )
      .max(32),
    avoid: z.array(z.string().min(1).max(200)).max(16),
  })
  .strict();

const outputSchema: z.ZodType<LearnerBriefPromptOutput> = z
  .object({
    sentences: z
      .array(
        z
          .object({
            text: z.string().trim().min(1).max(400),
            refs: z.array(z.string().trim().min(1).max(8)).max(12),
          })
          .strict(),
      )
      .max(24),
  })
  .strict();

const listed = (items: readonly { ref: string; text: string }[]): string =>
  items.length === 0 ? '(none)' : items.map((item) => `[${item.ref}] ${item.text}`).join('\n');

export const learnerBriefPrompt: PromptDefinition<'learner-brief'> = {
  name: 'learner-brief',
  version: '1.0.0',
  tier: 'TEACH',
  system:
    'You write short, warm, factual summaries for parents. You describe and never judge. Return JSON only.',
  inputSchema,
  render: (input) =>
    renderPrompt(TEMPLATE, input.context, {
      period: input.period,
      sessions: String(input.sessions),
      facts: listed(input.facts),
      episodes: listed(input.episodes),
      skills: listed(
        input.skills.map((skill) => ({
          ref: skill.ref,
          text: `${skill.name} (${skill.standing})`,
        })),
      ),
      wordCap: String(input.wordCap),
      avoid:
        input.avoid.length === 0
          ? ''
          : `A first draft broke these rules; do not repeat them:\n${input.avoid.map((item) => `- ${item}`).join('\n')}\n`,
    }),
  outputSchema,
  maxTokens: 900,
  jsonMode: true,
};
