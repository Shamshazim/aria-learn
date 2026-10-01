import type { TurnTimingResponse } from '@aria/shared';

import { turnTimingRequestSchema } from '@/schemas/telemetry.schema';
import type { TurnTimingService } from '@/services/telemetry/turn-timing.service';
import type { ApiResponse } from '@/types/http';

import type { Request, RequestHandler, Response } from 'express';

/**
 * `POST /telemetry/turn` — what the child's browser measured (X-04 part 2).
 *
 * 202, not 200. The client is not waiting on an answer and the histograms it feeds are not a
 * resource it can read back; "accepted" is the honest description of what happened. It also
 * keeps the route from ever looking like something a child's session depends on: a failure
 * here must cost a measurement, never a lesson.
 */
export type TelemetryController = Readonly<{ turn: RequestHandler }>;

export function createTelemetryController(deps: {
  timings: TurnTimingService;
}): TelemetryController {
  return {
    turn: async (request: Request, response: Response<ApiResponse<TurnTimingResponse>>) => {
      const body = turnTimingRequestSchema.parse(request.validated?.body);
      const result = await deps.timings.record(requireStudentId(request.studentId), body);
      response.status(202).json({ data: result });
    },
  };
}

function requireStudentId(value: string | undefined): string {
  if (value === undefined) throw new Error('student access middleware was not run');
  return value;
}
