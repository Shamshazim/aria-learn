import type { ZodType } from 'zod';

export async function measureCalls(
  count: number,
  operation: () => Promise<void>,
): Promise<Readonly<{ p95Ms: number; samples: readonly number[] }>> {
  const samples: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const started = performance.now();
    await operation();
    samples.push(performance.now() - started);
  }
  const sorted = [...samples].sort((left, right) => left - right);
  return { p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0, samples };
}

export async function postJson<T>(
  baseUrl: string,
  path: string,
  body: unknown,
  schema: ZodType<T>,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(`Benchmark request failed with HTTP ${String(response.status)}`);
  return schema.parse(await response.json());
}
