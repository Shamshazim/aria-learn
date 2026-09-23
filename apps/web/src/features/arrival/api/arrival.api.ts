import { arrivalResponseSchema, type ArrivalResponse, type Grade } from '@aria/shared';

import type { ApiClient } from '@/api';

export type ArrivalApi = Readonly<{
  /** `grade` is the development-only override; the API ignores it outside development. */
  arrive(signal?: AbortSignal, grade?: Grade): Promise<ArrivalResponse>;
}>;

export function createArrivalApi(client: ApiClient): ArrivalApi {
  return {
    arrive: (signal?: AbortSignal, grade?: Grade) =>
      client.post(
        '/api/v1/student/arrival',
        grade === undefined ? {} : { grade },
        arrivalResponseSchema,
        signal === undefined ? undefined : { signal },
      ),
  };
}
