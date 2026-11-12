import { AppError } from '@/errors/app-error';
import { ERROR_CODES } from '@/errors/codes';

/**
 * P3-06: the memory a correction names has itself been corrected since the client read it.
 * The 409 carries the row that is current now (or nothing, when it was retracted), so the
 * parent app can show that one and let the parent decide again.
 */
export class StaleCorrectionTargetError extends AppError {
  constructor(logMessage: string, currentId: string | null) {
    super(ERROR_CODES.CONFLICT, 409, 'That has already been changed.', {
      logMessage,
      ...(currentId === null ? {} : { details: { currentId } }),
    });
  }
}

export type RejectedValueRule = 'sensitive' | 'judgement';

const RULE_MESSAGES: Readonly<Record<RejectedValueRule, string>> = {
  sensitive:
    'That is private information, so Aria will not remember it. You can remove what she has.',
  judgement:
    'Aria remembers what a child does and likes, not judgements about them. Try describing it.',
};

/** P3-06: a replacement value the product will not keep. 422, with the rule it broke. */
export class RejectedValueError extends AppError {
  readonly rule: RejectedValueRule;

  constructor(rule: RejectedValueRule, logMessage: string) {
    super(ERROR_CODES.VALUE_REJECTED, 422, RULE_MESSAGES[rule], {
      logMessage,
      details: { rule },
    });
    this.rule = rule;
  }
}
