import { readCredential } from '@/middleware/credentials';
import type { StudentAccessResolver } from '@/middleware/student-access';

import type { ChildAuthService } from './child-auth.service';
import type { Request } from 'express';

/**
 * The adapter that finally fills the seam `requireStudentAccess` left open.
 *
 * P0-03 defined the resolver port and P0-04's runtime supplied a development-only fixed
 * student behind it. This is the real one: the student id comes from a child session row that
 * a picture secret opened, so the tutoring routes act as a child who proved they are that
 * child, and never as a student id a request named.
 */
export function createChildStudentAccess(auth: ChildAuthService): StudentAccessResolver {
  return {
    async resolve(request: Request) {
      const token = readCredential(request, 'childSession');
      // `null` is the port's "not configured", which becomes a 503. A missing credential is
      // not a misconfiguration, so it goes through `authenticate` and becomes a 401.
      const actor = await auth.authenticate(token ?? '');
      return { studentId: actor.studentId };
    },
  };
}
