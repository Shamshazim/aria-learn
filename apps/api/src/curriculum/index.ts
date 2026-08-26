/** Public read interface for the authored curriculum inventory. */
export { createInventoryService } from '@/curriculum/inventory.service';
export type { InventoryService, LessonReviewReport } from '@/curriculum/inventory.service';
export { loadLessonNotes } from '@/curriculum/lessons';
export type { LessonNote } from '@/curriculum/lessons';
export { buildVisual, firstVisualFor, visualsFor } from '@/curriculum/visuals';
export type { VisualRequest } from '@/curriculum/visuals';
