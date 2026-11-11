import type { RawDialogueTurn } from '@/privacy';
import type { SessionEventRecord } from '@/types/session';

const DIALOGUE_TURNS: Readonly<Record<string, number>> = { early: 6, middle: 10, senior: 14 };

/** P2H-04: the last few spoken turns, oldest first, for the prompt's conversation block. */
export function dialogueWindow(
  records: readonly SessionEventRecord[],
  band: string,
): readonly RawDialogueTurn[] {
  return records
    .filter(
      (record): record is typeof record & { text: string } =>
        (record.actor === 'aria' || record.actor === 'child') &&
        typeof record.text === 'string' &&
        record.text.trim() !== '' &&
        // P2H-05: a turn that carried personal information never enters the window at all.
        record.evidence.personalInfoRedacted !== true,
    )
    .slice(-(DIALOGUE_TURNS[band] ?? 10))
    .map((record) => ({
      speaker: record.actor === 'aria' ? 'aria' : 'child',
      text: record.text.slice(0, 500),
      // The crisis path stamps `evidence.safety`; that turn's words never leave the API.
      ...(record.evidence.safety === undefined ? {} : { safetyFlagged: true }),
    }));
}
