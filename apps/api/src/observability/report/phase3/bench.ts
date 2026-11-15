import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

const benchSchema = z.object({
  p95Ms: z.number().nonnegative(),
  at: z.iso.datetime(),
  calls: z.number().int(),
});

/** A benchmark older than this does not describe the build being judged. */
const MAX_AGE_MS = 7 * 86_400_000;

/** `npm run bench:arrival` leaves its result here for the Phase 3 report to read (P3-08). */
export async function writeArrivalBench(
  file: string,
  p95Ms: number,
  calls: number,
  now: Date,
): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify({ p95Ms, calls, at: now.toISOString() }, null, 2)}\n`);
}

/** The p95, or `null` with no result, an unreadable one, or one more than a week old. */
export async function readArrivalBench(file: string, now: Date): Promise<number | null> {
  const text = await readFile(file, 'utf8').catch(() => null);
  if (text === null) return null;
  const parsed = benchSchema.safeParse(JSON.parse(text));
  if (!parsed.success) return null;
  return now.getTime() - Date.parse(parsed.data.at) > MAX_AGE_MS ? null : parsed.data.p95Ms;
}
