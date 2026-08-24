import type { Band, Expects, MoveKind } from '@aria/shared';

import type { MovePlan, MovePlanResult, StreamContentKind } from '@/ai/streaming/types';
import { checkArithmetic, isArithmeticPass } from '@/quality/arithmetic';

const RESPONSE_TYPES: Readonly<Record<Band, ReadonlySet<Expects>>> = {
  early: new Set(['choice', 'speech', 'drag', 'none']),
  middle: new Set(['choice', 'text', 'number', 'speech', 'drag', 'none']),
  senior: new Set(['choice', 'text', 'number', 'speech', 'none']),
};
const CONTENT_MOVES = new Set<MoveKind>(['ASK', 'SHOW', 'REVEAL']);

export function validateMovePlan(plan: MovePlan, contentKind?: StreamContentKind): MovePlanResult {
  const reasons: string[] = [];
  validateTeachingClaim(plan, reasons);
  validateResponseType(plan, reasons);
  validateMoveRequirements(plan, reasons);
  validateArithmetic(plan, contentKind, reasons);
  return reasons.length === 0 ? { valid: true } : { valid: false, reasons };
}

function validateTeachingClaim(plan: MovePlan, reasons: string[]): void {
  if (plan.teachingClaim.trim().length === 0 || plan.teachingClaim.length > 500) {
    reasons.push('Teaching claim must be one bounded non-empty line.');
  }
  if (plan.teachingClaim.includes('\n')) reasons.push('Teaching claim must be one line.');
}

function validateResponseType(plan: MovePlan, reasons: string[]): void {
  if (!RESPONSE_TYPES[plan.band].has(plan.responseType)) {
    reasons.push(`${plan.responseType} is not permitted for the ${plan.band} band.`);
  }
}

function validateMoveRequirements(plan: MovePlan, reasons: string[]): void {
  if (CONTENT_MOVES.has(plan.moveKind) && plan.verifiedContentId === undefined) {
    reasons.push(`${plan.moveKind} requires verified content.`);
  }
  if (plan.moveKind === 'PRAISE' && plan.answerJudgement === 'incorrect') {
    reasons.push('PRAISE cannot follow an incorrect judgement.');
  }
}

function validateArithmetic(
  plan: MovePlan,
  contentKind: StreamContentKind | undefined,
  reasons: string[],
): void {
  if (contentKind === 'arithmetic' && plan.arithmetic === undefined) {
    reasons.push('Arithmetic content requires a deterministic arithmetic check.');
  } else if (plan.arithmetic !== undefined) {
    const result = checkArithmetic(plan.arithmetic.problem, plan.arithmetic.candidate);
    if (!isArithmeticPass(result))
      reasons.push(`Arithmetic plan is ${result.verdict}: ${result.reason}`);
  }
}
