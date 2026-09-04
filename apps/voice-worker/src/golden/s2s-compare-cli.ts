import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { voiceCandidateResultSchema } from './result.schema';
import {
  compareArms,
  pipelineArmFromGolden,
  type ArmSummary,
  type S2SComparison,
} from './s2s-compare';
import { s2sArmResultSchema, s2sObservationSchema, type S2SArmResult } from './s2s-result.schema';

/**
 * `npm run voice:s2s-compare -- --pipeline <result.json> --s2s <run.jsonl|result.json>`
 *
 * The pipeline arm is a `voice:golden` result; the s2s arm is either an arm result or the
 * JSONL run log a worker wrote with `VOICE_S2S_RUN_LOG` set. Writes
 * `dev-docs/golden/voice/runs/<date>-s2s.json` and prints the table the memo quotes.
 */
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const RUNS_DIR = path.join(REPO_ROOT, 'dev-docs/golden/voice/runs');

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const pipeline = pipelineArmFromGolden(
    voiceCandidateResultSchema.parse(JSON.parse(await readFile(args.pipeline, 'utf8'))),
  );
  const s2s = await readS2SArm(args.s2s);
  const comparison = compareArms(pipeline, s2s);
  await mkdir(RUNS_DIR, { recursive: true });
  const stamp = comparison.generatedAt.slice(0, 10);
  const out = path.join(RUNS_DIR, `${stamp}-s2s.json`);
  await writeFile(out, `${JSON.stringify(comparison, null, 2)}\n`);
  process.stdout.write(`${renderTable(comparison)}\nwritten ${path.relative(REPO_ROOT, out)}\n`);
  if (comparison.recommendation === 'insufficient_evidence') process.exitCode = 1;
}

function parseArgs(argv: readonly string[]): Readonly<{ pipeline: string; s2s: string }> {
  const read = (flag: string): string => {
    const index = argv.indexOf(flag);
    const value = index === -1 ? undefined : argv[index + 1];
    if (value === undefined) throw new Error(`Missing ${flag} <file>`);
    return path.resolve(REPO_ROOT, value);
  };
  return { pipeline: read('--pipeline'), s2s: read('--s2s') };
}

async function readS2SArm(file: string): Promise<S2SArmResult> {
  const text = await readFile(file, 'utf8');
  if (!file.endsWith('.jsonl')) return s2sArmResultSchema.parse(JSON.parse(text));
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  const header = JSON.parse(lines[0] ?? '{}') as { provider?: string };
  const observations = lines.slice(1).map((line) => s2sObservationSchema.parse(JSON.parse(line)));
  return s2sArmResultSchema.parse({
    arm: 's2s',
    provider: header.provider ?? 'unknown',
    generatedAt: new Date().toISOString(),
    observations,
  });
}

export function renderTable(comparison: S2SComparison): string {
  const rows: readonly (readonly [string, (arm: ArmSummary) => string])[] = [
    ['turns', (arm) => String(arm.turns)],
    ['first audio p95 (ms)', (arm) => String(arm.firstAudioP95Ms)],
    ['silence → reply p95 (ms)', (arm) => String(arm.silenceToReplyP95Ms)],
    ['interruption → silence p95 (ms)', (arm) => fmt(arm.interruptionToSilenceP95Ms)],
    ['overlaps / turn', (arm) => arm.overlapsPerTurn.toFixed(2)],
    ['off-plan rate', (arm) => ci(arm.offPlanRate)],
    ['safety escape words', (arm) => String(arm.safetyEscapeWords)],
    ['transcript lag p95 (ms)', (arm) => fmt(arm.transcriptLagP95Ms)],
    ['STT error rate', (arm) => ci(arm.sttErrorRate)],
    ['end-of-turn error rate', (arm) => ci(arm.endOfTurnErrorRate)],
    ['cost / turn (USD)', (arm) => arm.costPerTurnUsd.toFixed(4)],
    ['rubric sessions', (arm) => String(arm.rubricSessions)],
    ['rubric mean', (arm) => (arm.rubricMean === null ? '—' : arm.rubricMean.toFixed(2))],
  ];
  const lines = [
    `| metric | pipeline (${comparison.pipeline.provider}) | s2s (${comparison.s2s.provider}) |`,
    '| --- | --- | --- |',
    ...rows.map(
      ([label, cell]) => `| ${label} | ${cell(comparison.pipeline)} | ${cell(comparison.s2s)} |`,
    ),
    '',
    `recommendation: **${comparison.recommendation}**`,
    ...comparison.reasons.map((reason) => `- ${reason}`),
  ];
  return lines.join('\n');
}

function ci(value: ArmSummary['offPlanRate']): string {
  const { lower, upper } = value.confidence95;
  return `${(value.rate * 100).toFixed(1)}% [${(lower * 100).toFixed(1)}–${(upper * 100).toFixed(1)}]`;
}

function fmt(value: number | null): string {
  return value === null ? '—' : String(value);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  void main();
}
