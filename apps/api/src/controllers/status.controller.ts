import type { StatusResponse, StatusService } from '@/services/status.service';
import type { ApiResponse } from '@/types/http';

import type { Request, RequestHandler, Response } from 'express';

export type StatusController = Readonly<{ get: RequestHandler }>;

export function createStatusController(service: StatusService): StatusController {
  return {
    get: async (_request: Request, response: Response<ApiResponse<StatusResponse>>) => {
      response.status(200).json({ data: await service.getStatus() });
    },
  };
}
