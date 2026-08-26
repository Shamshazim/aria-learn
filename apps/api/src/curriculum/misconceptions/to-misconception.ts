import type { Misconception } from '@aria/shared';

import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** The shared shape, without the matcher: what the `misconception` table stores. */
export function toMisconception(authored: AuthoredMisconception): Misconception {
  return {
    id: authored.id,
    skillCode: authored.skillCode,
    name: authored.name,
    signature: authored.signature,
    remediation: authored.remediation,
    approach: authored.approach,
    model: authored.model,
  };
}
