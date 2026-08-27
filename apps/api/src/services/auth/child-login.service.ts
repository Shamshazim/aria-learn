import type { ChildSummary } from '@aria/shared';

import type { ChildCredentialService, ChildLoginAttempt, ChildSessionService } from '@/auth';
import { LockedError, UnauthorizedError } from '@/errors';
import { toChildSummary } from '@/mappers/child-summary.mapper';
import type { StudentRepository } from '@/repositories/student.repository';
import type { ParentChildrenService } from '@/services/parent/children.service';
import type { IssuedChildSession } from '@/types/auth';

/**
 * A child signing in on a device their parent is signed in on (P2H-12).
 *
 * The parent's own session is what says which family this device belongs to; the child's PIN
 * or picture sequence is what says which member of it is here. That is the shared-tablet
 * arrangement the ticket describes, and it is why a child session can be bound to a parent
 * without a child ever being asked for an email address.
 */
export type ChildLoginResult = Readonly<{
  child: ChildSummary;
  issued: IssuedChildSession;
}>;

export type ChildLoginService = Readonly<{
  login(
    input: Readonly<{
      parentId: string;
      childId: string;
      attempt: ChildLoginAttempt;
      deviceLabel: string | null;
    }>,
  ): Promise<ChildLoginResult>;
  logout(cookie: string): Promise<void>;
  refresh(cookie: string): Promise<ChildLoginResult | null>;
}>;

export function createChildLoginService(deps: {
  children: ParentChildrenService;
  credentials: ChildCredentialService;
  sessions: ChildSessionService;
  students: Pick<StudentRepository, 'findById'>;
}): ChildLoginService {
  return {
    login: async (input) => {
      const student = await deps.children.requireOwned(input.parentId, input.childId);
      const outcome = await deps.credentials.attempt(student.id, input.attempt);
      if (!outcome.ok) throw refusal(outcome.reason);
      // One live session per device, and a fresh one per login: a child who signs in again
      // must not leave the previous cookie working on a tablet they walked away from.
      await deps.sessions.endAllForStudent(student.id);
      const issued = await deps.sessions.issue({
        studentId: student.id,
        parentId: input.parentId,
        deviceLabel: input.deviceLabel,
      });
      return {
        child: toChildSummary(student, await deps.credentials.methodFor(student.id)),
        issued,
      };
    },

    logout: (cookie) => deps.sessions.end(cookie),

    refresh: async (cookie) => {
      const issued = await deps.sessions.rotate(cookie);
      if (issued === null) return null;
      return { child: await summarise(deps, issued.session.studentId), issued };
    },
  };
}

type Deps = Parameters<typeof createChildLoginService>[0];

async function summarise(deps: Deps, studentId: string): Promise<ChildSummary> {
  const student = await deps.students.findById(studentId);
  if (student === null) throw new UnauthorizedError('child disappeared during login');
  return toChildSummary(student, await deps.credentials.methodFor(studentId));
}

/**
 * A locked child gets its own status so the picker can show the one fixed sentence for it.
 * Everything else is the same 401: "wrong PIN" and "this child has no PIN yet" are different
 * facts about a family, and a login screen is not the place to learn either.
 */
function refusal(reason: 'wrong' | 'locked' | 'not-configured'): Error {
  if (reason === 'locked') return new LockedError('child login locked after repeated failures');
  return new UnauthorizedError(`child login refused: ${reason}`);
}
