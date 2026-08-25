import { z } from 'zod';

import { bandSchema } from '@aria/shared';

import { promptTextSchema, scrubbedContextSchema } from '@/ai/prompts/input.schema';
import { ARIA_PERSONA, REGISTERS } from '@/ai/prompts/persona/aria.persona';
import { renderDialogue } from '@/ai/prompts/render/dialogue.render';
import { renderPrompt } from '@/ai/prompts/render/render';
import type { PromptDefinition, RespondPromptInput, RespondPromptOutput } from '@/ai/prompts/types';

/** One instruction per move (and per approach where it changes what Aria does). */
const MOVE_INSTRUCTIONS: Readonly<Record<string, string>> = {
  SAY: 'Say one helpful thing that moves the child forward on the open item.',
  'SAY:answer-question':
    'The child asked a question. Answer it in at most two sentences, grounded in the skill. If you are not sure, say so honestly. Then invite them back to the open item in a few words.',
  'SAY:acknowledge-chat':
    'The child said something that is not an answer. Reply with one warm, specific sentence that shows you heard them, then in a few words bring them back to the open item.',
  'SAY:confirm-spoken-answer':
    'You did not hear the child clearly. Say, in a fresh way, that you did not catch it and ask them to say it again.',
  'SAY:reask-short':
    'The child went quiet. Ask the open question again in a shorter, friendlier way. Do not repeat your earlier wording.',
  'SAY:check-in':
    'The child has been quiet for a while. Gently check whether they are still there and want to keep going. One or two sentences.',
  HINT: 'Give one useful hint toward the open item without revealing the answer. Point at the very next step, not the whole path.',
  RETEACH:
    'The child is stuck. Explain the idea again a different way than before, using the given approach. Keep it to the one idea they need right now.',
  REVEAL:
    'Reveal the answer kindly and show in one or two sentences why it is the answer. Do not scold.',
  PRAISE:
    'The child got it right. Praise the specific thing they did well, naming what was right about their answer. No generic praise.',
  BREAK: 'Say goodbye for now warmly, in one or two sentences, as a person would.',
  END: 'End the session warmly. Name one real thing the child worked on today, then say goodbye.',
  SWITCH: 'Tell the child, kindly, that you are going to try a different step first.',
  CHECK_IN: 'Ask the child how they are doing today, in one friendly sentence.',
  WELCOME: 'Welcome the child warmly in one or two sentences.',
  RECOMMEND: 'Suggest, in one sentence, what to work on today.',
  LISTEN: 'Invite the child to speak or read aloud, in one short sentence.',
  SHOW: 'Say what the child should look at and do, in one sentence.',
};

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
      instruction:
        MOVE_INSTRUCTIONS[`${input.move}:${input.approach}`] ??
        MOVE_INSTRUCTIONS[input.move] ??
        'Say one helpful sentence.',
    }),
  outputSchema,
  maxTokens: 300,
  jsonMode: true,
};
