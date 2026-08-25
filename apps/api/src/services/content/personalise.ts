import type { ContentScope } from '@/content';

export function contentScope(
  input: Readonly<{
    studentId: string;
    usesLearnerMemory: boolean;
  }>,
): ContentScope {
  return input.usesLearnerMemory
    ? { kind: 'personalised', studentId: input.studentId }
    : { kind: 'shareable' };
}
