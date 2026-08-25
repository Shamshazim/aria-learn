import type { AppConfig } from '@/config';
import type { StudentAccessResolver } from '@/middleware/student-access';

/** Development-only fixed profile until the separately specified P0-28 identity runtime lands. */
export function createConfiguredStudentAccess(config: AppConfig): StudentAccessResolver {
  return {
    resolve: () =>
      Promise.resolve(
        config.isProduction || config.demoStudentId === undefined
          ? null
          : { studentId: config.demoStudentId },
      ),
  };
}
