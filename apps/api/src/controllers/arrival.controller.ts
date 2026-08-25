import type { ArrivalResponse } from '@aria/shared';

import type { ArrivalResult } from '@/services/arrival/arrival.service';
import type { ApiResponse } from '@/types/http';

import type { Request, RequestHandler, Response } from 'express';

export type ArrivalController = RequestHandler;

export function createArrivalController(
  service: Readonly<{
    arrive(studentId: string): Promise<ArrivalResult>;
  }>,
): ArrivalController {
  return async (request: Request, response: Response<ApiResponse<ArrivalResponse>>) => {
    const studentId = requireStudentId(request.studentId);
    const result = await service.arrive(studentId);
    response.status(200).json({ data: { ...result, moves: [...result.moves] } });
  };
}

function requireStudentId(value: string | undefined): string {
  if (value === undefined) throw new Error('student access middleware was not run');
  return value;
}
