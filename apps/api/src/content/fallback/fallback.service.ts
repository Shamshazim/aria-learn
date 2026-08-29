import type { Skill } from '@aria/shared';

import { FALLBACK_CONTENT, type FallbackDefinition } from '@/content/fallback/fallback.data';
import { topicFallbacks } from '@/content/fallback/topic-fallback';
import type { InventoryService } from '@/curriculum';
import type { GatePass, QualityGate } from '@/quality';

export type VerifiedFallback = Readonly<{
  definition: FallbackDefinition;
  pass: GatePass;
}>;

export type FallbackService = Readonly<{
  get(skillCode: string): VerifiedFallback | null;
}>;

/**
 * Verifies the checked-in bank and its complete skill coverage before serving any item.
 *
 * An authored skill must have a reviewed item in the bank. A catalogue topic has no reviewer
 * yet, so its last resort is derived from its own name and objectives and gated like any
 * other text; it is a conversation opener, never a fact.
 */
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
    if (verified.has(skill.code)) continue;
    const derived = skill.lessonRef === null ? firstPassing(dependencies.gate, skill) : null;
    if (derived === null) throw new Error(`Missing verified fallback for ${skill.code}`);
    verified.set(skill.code, derived);
  }
  return {
    get(skillCode) {
      return verified.get(skillCode) ?? null;
    },
  };
}

function firstPassing(gate: QualityGate, skill: Skill): VerifiedFallback | null {
  for (const definition of topicFallbacks(skill)) {
    const verdict = gate(definition.gateInput);
    if (verdict.verdict === 'pass') return { definition, pass: verdict.pass };
  }
  return null;
}
