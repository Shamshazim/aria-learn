import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LessonNoteError, parseLessonNote } from '@/curriculum/lessons/lesson.parse';
import type { LessonNote } from '@/curriculum/lessons/lesson.types';

const NOTES_DIRECTORY = fileURLToPath(new URL('.', import.meta.url));

/**
 * Reads the authored notes off disk, keyed by skill code (P2H-10).
 *
 * The notes are checked-in assets read once when the inventory is built, in the same sense
 * that configuration is read once at boot. Nothing caches them in module scope, so a test can
 * point the loader at a fixture directory and get a different inventory.
 */
export function loadLessonNotes(
  directory: string = NOTES_DIRECTORY,
): ReadonlyMap<string, LessonNote> {
  const notes = new Map<string, LessonNote>();
  for (const fileName of readdirSync(directory).sort()) {
    if (!fileName.endsWith('.md') || fileName === 'REVIEW.md') continue;
    const note = parseLessonNote(readFileSync(join(directory, fileName), 'utf8'), fileName);
    if (notes.has(note.skillCode)) {
      throw new LessonNoteError(`Two lesson notes claim skill ${note.skillCode}`);
    }
    notes.set(note.skillCode, note);
  }
  return notes;
}
