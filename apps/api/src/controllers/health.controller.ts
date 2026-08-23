import type { HealthStatus } from '@/schemas/health.schema';
import type { HealthService } from '@/services/health.service';
import type { ApiResponse } from '@/types/http';

import type { Request, RequestHandler, Response } from 'express';

/**
 * HTTP in, HTTP out.
 *
 * The controller calls one service and maps the result to a status code and a response DTO.
 * There is no business rule here and no `if` chain about one — if either appears, it belongs
 * in the service (CODE-STANDARDS §3.1).
 */
export type HealthController = {
  get: RequestHandler;
};

export function createHealthController(healthService: HealthService): HealthController {
  return {
    get: (_req: Request, res: Response<ApiResponse<HealthStatus>>): void => {
      res.status(200).json({ data: healthService.getHealth() });
    },
  };
}
