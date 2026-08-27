import { REGISTERS } from '@/ai/prompts/persona/aria.persona';
import { instructionFor } from '@/ai/prompts/persona/move-prompt.map';
import { renderDialogue } from '@/ai/prompts/render/dialogue.render';
import { renderPrompt } from '@/ai/prompts/render/render';
import type { RespondPromptInput } from '@/ai/prompts/types';

/**
 * The situation Aria is answering, shared by the two `respond` prompts (P2H-03, P2H-07).
 *
 * They differ in one line — how the answer comes back. The buffered prompt asks for JSON so a
 * schema can check it; the streamed one asks for plain sentences, because a JSON envelope
 * cannot be split at a sentence boundary while it is still arriving. Everything a child would
 * notice about the answer is decided here, once, so the two cannot drift apart.
 */
const SITUATION = `{{register}}

{{dialogue}}

{{lesson}}
Situation:
- Subject: {{subject}}
- Skill: {{skill}}
- Open item (what the child is working on): {{question}}
- What the child just said or did: {{learnerSaid}}
- Grading: {{grading}}
- Approach to use: {{approach}}
{{answerKey}}{{moveInputs}}
Your move now: {{move}}
Instruction: {{instruction}}

`;

export function renderRespondPrompt(input: RespondPromptInput, closing: string): string {
  return renderPrompt(SITUATION + closing, input.context, {
    register: REGISTERS[input.band],
    dialogue: renderDialogue(input.context),
    subject: input.subject,
    // Blank rather than absent when there is no note, so the prompt has no dangling heading.
    lesson: input.lesson === undefined ? '' : `${input.lesson}\n`,
    // Blank rather than absent for the same reason as the lesson note: no dangling heading.
    moveInputs: input.moveInputs === undefined ? '' : `${input.moveInputs}\n`,
    skill: input.skill ?? 'general practice',
    question: input.question ?? 'no open item yet',
    learnerSaid: input.learnerSaid ?? '(nothing yet)',
    grading: input.correct === undefined ? 'not graded' : input.correct ? 'correct' : 'not correct',
    approach: input.approach,
    answerKey:
      input.answerKey === undefined
        ? ''
        : `- The correct answer is "${input.answerKey}". Only say it if your move is REVEAL.\n`,
    move: input.move,
    instruction: instructionFor(input.move, input.approach),
  });
}
