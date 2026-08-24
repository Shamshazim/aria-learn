import { FALLBACK_CONTENT, type FallbackDefinition } from '@/content/fallback/fallback.data';
import type { InventoryService } from '@/curriculum';
import type { GatePass, QualityGate } from '@/quality';

export type VerifiedFallback = Readonly<{
  definition: FallbackDefinition;
  pass: GatePass;
}>;

export type FallbackService = Readonly<{
  get(skillCode: string): VerifiedFallback;
}>;

/** Verifies the checked-in bank and its complete skill coverage before serving any item. */
export function createFallbackService(dependencies: {
  inventory: InventoryService;
  gate: QualityGate;
}): FallbackService {
  const verified = new Map<string, VerifiedFallback>();
  for (const definition of FALLBACK_CONTENT) {
    const verdict = dependencies.gate(definition.gateInput);
    if (verdict.verdict === 'fail') {
      throw new Error(
        `Fallback ${definition.skillCode} failed: ${verdict.reasons.map((reason) => reason.code).join(', ')}`,
      );
    }
    verified.set(definition.skillCode, { definition, pass: verdict.pass });
  }
  for (const skill of dependencies.inventory.listSkills()) {
    if (!verified.has(skill.code)) throw new Error(`Missing verified fallback for ${skill.code}`);
  }
  return {
    get(skillCode) {
      const item = verified.get(skillCode);
      if (item === undefined) throw new Error(`No verified fallback for ${skillCode}`);
      return item;
    },
  };
}
