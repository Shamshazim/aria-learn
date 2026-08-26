import { NO_PRONUNCIATION_HINTS } from '@aria/voice';

import type { StudentRepository } from '@/repositories/student.repository';
import type { PronunciationSource } from '@/services/voice/realtime.service';

/**
 * How this child's name is said (P2H-08, wired by P2H-12).
 *
 * P2H-08 built the whole path from a hint to synthesised speech and left this end of it as
 * `NO_PRONUNCIATION_SOURCE`, waiting for a profile to read from. This is that profile.
 *
 * A respelling applies to the written name only. `applyPronunciation` replaces whole words in
 * spoken text, so the screen keeps "Siobhan" while the engine is handed "Shiv-awn" — which is
 * the entire point: a child should not have to be renamed to be said correctly.
 */
export function createStudentPronunciationSource(
  students: Pick<StudentRepository, 'findById'>,
): PronunciationSource {
  return {
    forStudent: async (studentId) => {
      const student = await students.findById(studentId);
      const spelling = student?.settings.pronunciation ?? null;
      if (student === null || spelling === null) return NO_PRONUNCIATION_HINTS;
      return { [student.displayName]: spelling };
    },
  };
}
