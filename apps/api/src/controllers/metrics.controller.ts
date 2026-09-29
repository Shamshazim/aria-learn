import { renderPrometheus } from '@/observability/exporters/prometheus';
import type { Metrics } from '@/observability/metrics';

import type { Request, RequestHandler, Response } from 'express';

/**
 * `GET /metrics` — the scrape endpoint (X-04).
 *
 * Text, not the JSON envelope every other route returns, because a scraper is not a client of
 * this API: it speaks one format and this has to be that format. The envelope is for the web
 * app and the worker; putting a Prometheus body inside `{ data: … }` would mean nothing could
 * read it.
 *
 * Behind `operatorOnly`, like `/status`: metric values are aggregate and carry no child, but
 * they do describe the shape of the service to anybody who asks, and there is no reason for
 * that to be public.
 */
export const PROMETHEUS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

export type MetricsController = Readonly<{ get: RequestHandler }>;

export function createMetricsController(deps: { metrics: Metrics }): MetricsController {
  return {
    get: (_request: Request, response: Response) => {
      const { body } = renderPrometheus(deps.metrics.collect());
      response.status(200).type(PROMETHEUS_CONTENT_TYPE).send(body);
    },
  };
}
