import type { ContentScope } from '@/content/types';

/** Personalised content is always labelled with its owning student before persistence. */
export function personalisedFor(scope: ContentScope): string | null {
  return scope.kind === 'personalised' ? scope.studentId : null;
}

export function mayServeTo(personalisedForId: string | null, studentId: string): boolean {
  return personalisedForId === null || personalisedForId === studentId;
}
