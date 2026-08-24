import type { GateInput } from '@/quality/gate.types';

export function childFacingText(input: GateInput): string {
  return input.kind === 'multiple-choice'
    ? [input.childText, ...input.options.map((option) => option.text)].join(' ')
    : input.childText;
}
