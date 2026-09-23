import type { ArrivalResponse, Grade } from '@aria/shared';

import { arrivalRequestSchema } from '@/schemas/arrival.schema';
import type { ArrivalResult } from '@/services/arrival/arrival.service';
import type { ApiResponse } from '@/types/http';

import type { Request, RequestHandler, Response } from 'express';

export type ArrivalController = RequestHandler;

export function createArrivalController(
  service: Readonly<{
    arrive(studentId: string, options?: Readonly<{ grade?: Grade }>): Promise<ArrivalResult>;
  }>,
): ArrivalController {
  return async (request: Request, response: Response<ApiResponse<ArrivalResponse>>) => {
    const studentId = requireStudentId(request.studentId);
    const body = arrivalRequestSchema.parse(request.validated?.body ?? {});
    const result = await service.arrive(
      studentId,
      body.grade === undefined ? {} : { grade: body.grade },
    );
    response
      .status(200)
      .json({ data: { ...result, moves: [...result.moves], classes: [...result.classes] } });
  };
}

function requireStudentId(value: string | undefined): string {
  if (value === undefined) throw new Error('student access middleware was not run');
  return value;
}
