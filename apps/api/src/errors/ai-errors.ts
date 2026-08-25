import { ServiceUnavailableError, ValidationError } from '@/errors/app-error';

export class SpendCapExceededError extends ServiceUnavailableError {
  constructor(readonly studentId: string) {
    super('Student daily AI spend cap reached');
  }
}

export class MovePlanValidationError extends ValidationError {
  constructor(readonly reasons: readonly string[]) {
    super(`Move plan failed: ${reasons.join(' ')}`);
  }
}

export class StreamGateError extends ServiceUnavailableError {
  constructor() {
    super('Generated stream and verified fallback both failed the quality gate');
  }
}
