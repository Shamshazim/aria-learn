/** The authored teaching notes: one per skill, read from the `.md` files beside this file. */
export { loadLessonNotes } from '@/curriculum/lessons/lesson.loader';
export { LessonNoteError, parseLessonNote } from '@/curriculum/lessons/lesson.parse';
export type { LessonNote, LessonReview } from '@/curriculum/lessons/lesson.types';
