import { arrivalResponseSchema, type ArrivalResponse } from '@aria/shared';

import type { ApiClient } from '@/api';

export type ArrivalApi = Readonly<{ arrive(signal?: AbortSignal): Promise<ArrivalResponse> }>;

export function createArrivalApi(client: ApiClient): ArrivalApi {
  return {
    arrive: (signal?: AbortSignal) =>
      client.post(
        '/api/v1/student/arrival',
        {},
        arrivalResponseSchema,
        signal === undefined ? undefined : { signal },
      ),
  };
}
