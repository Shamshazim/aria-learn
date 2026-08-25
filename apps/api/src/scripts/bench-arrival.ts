import { z } from 'zod';

import { arrivalResponseSchema } from '@aria/shared';

import { measureCalls, postJson } from '@/scripts/benchmark';

const CALLS = 100;
const BAR_MS = 500;
const baseUrl = process.env.BENCH_API_URL ?? 'http://127.0.0.1:3000';
const envelope = z.object({ data: arrivalResponseSchema });
const result = await measureCalls(CALLS, async () => {
  await postJson(baseUrl, '/api/v1/student/arrival', {}, envelope);
});

process.stdout.write(
  `arrival_visible_p95_ms=${result.p95Ms.toFixed(1)} n=${String(CALLS)} bar=<${String(BAR_MS)}\n`,
);
if (result.p95Ms >= BAR_MS) process.exitCode = 1;
