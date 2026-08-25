import type { AppConfig } from '@/config';
import type { StudentAccessResolver } from '@/middleware/student-access';
import type { ChildAuthService } from '@/services/identity/child-auth.service';
import { createChildStudentAccess } from '@/services/identity/student-access';

/**
 * Which credential the tutoring routes trust.
 *
 * P0-28 made the real answer available, so it is the answer wherever the identity runtime is
 * wired: a child session opened with a picture secret on an authorised device. The fixed
 * profile below survives only for a developer running the tutor loop without any of that, and
 * boot refuses it in production (`ARIA_DEMO_STUDENT_ID` is forbidden there).
 */
export function createConfiguredStudentAccess(
  config: AppConfig,
  childAuth?: ChildAuthService,
): StudentAccessResolver {
  if (childAuth !== undefined) return createChildStudentAccess(childAuth);

  return {
    resolve: () =>
      Promise.resolve(
        config.isProduction || config.demoStudentId === undefined
          ? null
          : { studentId: config.demoStudentId },
      ),
  };
}
