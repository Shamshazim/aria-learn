import { randomUUID } from 'node:crypto';

import type { Band } from '@aria/shared';

import { readConfig, readVoiceIds } from '@/config';
import { closePool, createPool } from '@/db';
import { createLogger } from '@/lib/logger';
import { createSpeechAssetRepository } from '@/repositories/speech-asset.repository';
import {
  createBridgeSynthesisService,
  planBridgeSynthesis,
  type BridgeSynthesiser,
  type SpeechAudioWriter,
} from '@/services/voice/bridge-synthesis.service';

/**
 * `npm run synth:bridges -w @aria/api [-- --dry-run]`.
 *
 * A dry run needs neither a database nor a synthesiser, so it is the one a reviewer can run:
 * it prints exactly which clips a full run would record. A wet run refuses to start until a
 * speech provider is wired in, because writing rows for audio that does not exist would leave
 * a library that fails at the moment a child is waiting on it.
 */
async function main(): Promise<void> {
  if (process.argv.includes('--dry-run')) {
    // Straight from the environment, not through `readConfig`: a reviewer checking what would be
    // recorded should not need a database URL to see a list of sentences.
    const plan = planBridgeSynthesis(planningVoices(readVoiceIds(process.env)));
    process.stdout.write(`${JSON.stringify(summary(plan), null, 2)}\n`);
    return;
  }
  const config = readConfig();
  // A wet run records real audio under a hash that includes the voice id, so a band without one
  // is left out rather than recorded against a placeholder nobody could ever play.
  const voices = config.voice?.ttsVoices ?? readVoiceIds(process.env);
  const logger = createLogger({ level: config.logLevel });
  const pool = createPool(config.database, logger);
  try {
    const service = createBridgeSynthesisService({
      assets: createSpeechAssetRepository(pool),
      synthesiser: unconfiguredSynthesiser(),
      storage: unconfiguredWriter(),
      ids: { next: () => randomUUID() },
    });
    const report = await service.run({ voices, dryRun: false });
    logger.info(report, 'Bridge library synthesised');
  } finally {
    await closePool(pool, logger);
  }
}

/**
 * A dry run shows the whole plan, including bands P2-01 has not chosen a voice for yet: the
 * placeholder is what makes "this band is unconfigured" visible in the output rather than an
 * absence a reviewer has to notice. It never reaches a wet run, and so never reaches a hash.
 */
function planningVoices(
  voices: Readonly<Record<Band, string | undefined>>,
): Readonly<Record<Band, string>> {
  return {
    early: voices.early ?? 'unconfigured-early',
    middle: voices.middle ?? 'unconfigured-middle',
    senior: voices.senior ?? 'unconfigured-senior',
  };
}

function summary(
  plan: readonly ReturnType<typeof planBridgeSynthesis>[number][],
): Readonly<Record<string, number | readonly string[]>> {
  return {
    planned: plan.length,
    bands: [...new Set(plan.map((entry) => entry.band))],
    buckets: [...new Set(plan.map((entry) => entry.bucket))],
    voices: [...new Set(plan.map((entry) => entry.voice))],
  };
}

/** P2-01 has not chosen a provider, so there is nothing here to call yet. */
function unconfiguredSynthesiser(): BridgeSynthesiser {
  return {
    synthesise: () =>
      Promise.reject(
        new Error('No speech synthesiser is configured; run with --dry-run until P2-01 lands'),
      ),
  };
}

function unconfiguredWriter(): SpeechAudioWriter {
  return {
    write: () => Promise.reject(new Error('No speech audio store is configured')),
  };
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
