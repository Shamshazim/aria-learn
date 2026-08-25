import { z } from 'zod';

import { gradeSchema, sessionStartResponseSchema } from '@aria/shared';

import { postJson } from '@/scripts/benchmark';

const CALLS = 100;
const BAR_MS = 1_000;
const baseUrl = process.env.BENCH_API_URL ?? 'http://127.0.0.1:3000';
const grade = gradeSchema.parse(process.env.BENCH_GRADE ?? '4');
const subject = process.env.BENCH_SUBJECT ?? 'math';
const startEnvelope = z.object({ data: sessionStartResponseSchema });
const endEnvelope = z.object({ data: z.object({ sessionId: z.string() }) });
const samples: number[] = [];
for (let index = 0; index < CALLS; index += 1) {
  const beforeContent = performance.now();
  const started = await postJson(
    baseUrl,
    '/api/v1/student/session',
    {
      subject,
      grade,
      fromRecommendation: false,
    },
    startEnvelope,
  );
  samples.push(performance.now() - beforeContent);
  await postJson(
    baseUrl,
    '/api/v1/student/session/end',
    {
      sessionId: started.data.session.sessionId,
      reason: 'complete',
    },
    endEnvelope,
  );
}
const sorted = [...samples].sort((left, right) => left - right);
const p95Ms = sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0;

process.stdout.write(
  `content_wait_p95_ms=${p95Ms.toFixed(1)} n=${String(CALLS)} bar=<${String(BAR_MS)}\n`,
);
if (p95Ms >= BAR_MS) process.exitCode = 1;
