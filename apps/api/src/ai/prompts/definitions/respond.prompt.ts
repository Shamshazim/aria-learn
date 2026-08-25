import { z } from 'zod';

import { bandSchema } from '@aria/shared';

import { promptTextSchema, scrubbedContextSchema } from '@/ai/prompts/input.schema';
import { ARIA_PERSONA, REGISTERS } from '@/ai/prompts/persona/aria.persona';
import { instructionFor } from '@/ai/prompts/persona/move-prompt.map';
import { renderDialogue } from '@/ai/prompts/render/dialogue.render';
import { renderPrompt } from '@/ai/prompts/render/render';
import type { PromptDefinition, RespondPromptInput, RespondPromptOutput } from '@/ai/prompts/types';

const TEMPLATE = `{{register}}

{{dialogue}}

Situation:
- Subject: {{subject}}
- Skill: {{skill}}
- Open item (what the child is working on): {{question}}
- What the child just said or did: {{learnerSaid}}
- Grading: {{grading}}
- Approach to use: {{approach}}
{{answerKey}}
Your move now: {{move}}
Instruction: {{instruction}}

Return JSON with one child-facing field named "text". Plain sentences only.`;

const outputSchema: z.ZodType<RespondPromptOutput> = z
  .object({ text: z.string().trim().min(1).max(600) })
  .strict();

const inputSchema: z.ZodType<RespondPromptInput> = z
  .object({
    context: scrubbedContextSchema,
    band: bandSchema,
    move: promptTextSchema,
    approach: promptTextSchema,
    subject: promptTextSchema,
    skill: promptTextSchema.optional(),
    question: promptTextSchema.optional(),
    learnerSaid: promptTextSchema.optional(),
    answerKey: promptTextSchema.optional(),
    correct: z.boolean().optional(),
  })
  .strict();

export const respondPrompt: PromptDefinition<'respond'> = {
  name: 'respond',
  version: '1.0.0',
  tier: 'TEACH',
  system: ARIA_PERSONA,
  inputSchema,
  render: (input) =>
    renderPrompt(TEMPLATE, input.context, {
      register: REGISTERS[input.band],
      dialogue: renderDialogue(input.context),
      subject: input.subject,
      skill: input.skill ?? 'general practice',
      question: input.question ?? 'no open item yet',
      learnerSaid: input.learnerSaid ?? '(nothing yet)',
      grading:
        input.correct === undefined ? 'not graded' : input.correct ? 'correct' : 'not correct',
      approach: input.approach,
      answerKey:
        input.answerKey === undefined
          ? ''
          : `- The correct answer is "${input.answerKey}". Only say it if your move is REVEAL.\n`,
      move: input.move,
      instruction: instructionFor(input.move, input.approach),
    }),
  outputSchema,
  maxTokens: 300,
  jsonMode: true,
};
