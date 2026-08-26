import { childSessionResponseSchema } from '@aria/shared';
import type { ChildSessionResponse } from '@aria/shared';

import type { AuthControllers } from '@/controllers/auth.controller';
import type { Clock } from '@/lib/clock';
import { toChildSummary } from '@/mappers/child-summary.mapper';
import type { StudentRepository } from '@/repositories/student.repository';
import type { ApiResponse } from '@/types/http';

import { CHILD_SESSION_IDLE_MS, CHILD_SESSION_MAX_MS } from './child-session.service';

import type { Request, RequestHandler, Response } from 'express';

/**
 * The development bypass, and only that (P2H-12).
 *
 * A deployment with no Supabase project still has to be usable by whoever is building it, and
 * `ALLOW_DEMO_STUDENT` already makes every student route resolve to one fixed child. What was
 * missing is that the *web app* asks the server whether this device holds a session, and with
 * no auth routes mounted it got a 404 and sent everybody to a sign-in screen that could not
 * work. This answers that one question with "yes, the demo child".
 *
 * It issues no cookie and writes no row: `requireChildSession` is already short-circuited by
 * the same config, so there is nothing for a session to be. `config/auth.ts` refuses the flag
 * unless `NODE_ENV=development`, so there is no arrangement of variables that reaches this in
 * production.
 */
export function createDemoAuthControllers(deps: {
  students: Pick<StudentRepository, 'findById'>;
  demoStudentId: string;
  clock: Clock;
}): AuthControllers {
  const refuse: RequestHandler = (_request, response) => {
    response
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Not found.', requestId: 'demo' } });
  };
  return {
    // Nobody signs in or out of a session that was never issued.
    login: refuse,
    logout: refuse,
    refresh: async (_request: Request, response: Response<ApiResponse<ChildSessionResponse>>) => {
      response.status(200).json({ data: await demoSession(deps) });
    },
  };
}

async function demoSession(
  deps: Parameters<typeof createDemoAuthControllers>[0],
): Promise<ChildSessionResponse> {
  const student = await deps.students.findById(deps.demoStudentId);
  if (student === null) {
    throw new Error(`ARIA_DEMO_STUDENT_ID ${deps.demoStudentId} is not a student row`);
  }
  const now = deps.clock.now();
  return childSessionResponseSchema.parse({
    child: toChildSummary(student, 'family-device'),
    expiresAt: new Date(now.getTime() + CHILD_SESSION_MAX_MS).toISOString(),
    idleExpiresAt: new Date(now.getTime() + CHILD_SESSION_IDLE_MS).toISOString(),
  });
}
