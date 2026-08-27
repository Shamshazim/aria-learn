export type PreSynthesisSnapshot = Readonly<{
  generated: number;
  played: number;
  wasted: number;
  generatedCostUsd: number;
  wastedCostUsd: number;
}>;

/** Tracks speculative speech without retaining text, audio, or child identifiers. */
export function createPreSynthesisTracker(): Readonly<{
  generated(assetId: string, costUsd: number): void;
  played(assetId: string): void;
  snapshot(): PreSynthesisSnapshot;
}> {
  const assets = new Map<string, Readonly<{ costUsd: number; played: boolean }>>();
  return {
    generated: (assetId, costUsd) => {
      if (!Number.isFinite(costUsd) || costUsd < 0)
        throw new Error('TTS cost must be non-negative');
      assets.set(assetId, { costUsd, played: false });
    },
    played: (assetId) => {
      const asset = assets.get(assetId);
      if (asset === undefined) return;
      assets.set(assetId, { ...asset, played: true });
    },
    snapshot: () => {
      const values = [...assets.values()];
      const unused = values.filter((asset) => !asset.played);
      return {
        generated: values.length,
        played: values.length - unused.length,
        wasted: unused.length,
        generatedCostUsd: sumCost(values),
        wastedCostUsd: sumCost(unused),
      };
    },
  };
}

function sumCost(values: readonly Readonly<{ costUsd: number }>[]): number {
  return values.reduce((total, asset) => total + asset.costUsd, 0);
}
