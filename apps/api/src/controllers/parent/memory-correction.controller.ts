import { requireParent } from '@/auth';
import {
  memoryCorrectionRequestSchema,
  memoryCorrectionResponseSchema,
  type MemoryCorrectionResponse,
} from '@/schemas/parent/memory-correction.schema';
import { childParamsSchema } from '@/schemas/parent.schema';
import type { ParentCorrectionService } from '@/services/memory/correct.service';
import type { ApiResponse } from '@/types/http';

import type { Request, RequestHandler, Response } from 'express';

export type MemoryCorrectionControllers = Readonly<{ correct: RequestHandler }>;

/**
 * `POST /parent/children/:id/learner-memory/correct` (P3-06). Who owns whom is the service's
 * check, not this file's; a correction that changed nothing is still a 200.
 */
export function createMemoryCorrectionControllers(deps: {
  corrections: ParentCorrectionService;
}): MemoryCorrectionControllers {
  return {
    correct: async (
      request: Request,
      response: Response<ApiResponse<MemoryCorrectionResponse>>,
    ) => {
      const { id } = childParamsSchema.parse(request.validated?.params);
      const body = memoryCorrectionRequestSchema.parse(request.validated?.body);
      const result = await deps.corrections.correct({
        parentId: requireParent(request).id,
        childId: id,
        request: {
          targetKind: body.targetKind,
          targetId: body.targetId,
          action: body.action,
          newValue: body.newValue,
          reason: body.reason,
        },
      });
      response.status(200).json({ data: memoryCorrectionResponseSchema.parse(result) });
    },
  };
}
