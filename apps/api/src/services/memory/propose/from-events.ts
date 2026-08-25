import { containsSensitiveDisclosure } from '@/safety';
import type { SessionEventRecord } from '@/types/session';

export type MemoryProposal = Readonly<{
  kind: string;
  text: string;
  confidence: number;
  temporary: boolean;
  sensitive: boolean;
  sourceEventId: string;
  skillCode: string | null;
}>;

export function proposeFromEvents(
  events: readonly SessionEventRecord[],
): readonly MemoryProposal[] {
  const proposals: MemoryProposal[] = [];
  for (const event of events) {
    if (event.actor !== 'aria' || event.text === null) continue;
    if (event.kind === 'PRAISE') {
      proposals.push({
        kind: 'practice_persistence',
        text:
          event.skillCode === null
            ? 'Finished a practice step successfully.'
            : `Finished a ${event.skillCode} practice step successfully.`,
        confidence: 0.95,
        temporary: false,
        sensitive: false,
        sourceEventId: event.id,
        skillCode: event.skillCode,
      });
    }
    if (event.kind === 'BREAK') {
      proposals.push({
        kind: 'mood',
        text: 'Needed a break during this session.',
        confidence: 0.6,
        temporary: true,
        sensitive: containsSensitiveDisclosure(event.text),
        sourceEventId: event.id,
        skillCode: event.skillCode,
      });
    }
  }
  return proposals;
}
