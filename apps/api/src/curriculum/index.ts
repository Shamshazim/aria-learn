/** Public read interface for the authored curriculum inventory. */
export { createInventoryService } from '@/curriculum/inventory.service';
export type { InventoryService, LessonReviewReport } from '@/curriculum/inventory.service';
export { loadLessonNotes } from '@/curriculum/lessons';
export type { LessonNote } from '@/curriculum/lessons';
export { visualsFor } from '@/curriculum/visuals/show-payloads';
