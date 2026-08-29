import { z } from 'zod';

/**
 * The shape of one legacy curriculum file, exactly as `legacy/backend` shipped it:
 * subject → grades → units → lessons → topics, each topic with its learning objectives.
 *
 * Nothing here is renamed or trimmed on the way in. The files under `data/` are byte-for-byte
 * copies (plus `science.json`, transcribed from the legacy V14 migration), so a parent who
 * knew the old app finds the same units and lessons in this one.
 */
const name = z.string().trim().min(1).max(255);

export const catalogueTopicSchema = z
  .object({ name, objectives: z.array(z.string().trim().min(1).max(500)).min(1).max(12) })
  .strict();

export const catalogueLessonSchema = z
  .object({ name, topics: z.array(catalogueTopicSchema).min(1).max(40) })
  .strict();

export const catalogueUnitSchema = z
  .object({ name, lessons: z.array(catalogueLessonSchema).min(1).max(40) })
  .strict();

export const catalogueGradeSchema = z
  .object({
    name,
    level: z.number().int().min(1).max(8),
    units: z.array(catalogueUnitSchema).min(1).max(40),
  })
  .strict();

export const catalogueFileSchema = z
  .object({ subject: name, grades: z.array(catalogueGradeSchema).min(1).max(10) })
  .strict();

export type CatalogueTopic = z.infer<typeof catalogueTopicSchema>;
export type CatalogueLesson = z.infer<typeof catalogueLessonSchema>;
export type CatalogueUnit = z.infer<typeof catalogueUnitSchema>;
export type CatalogueGrade = z.infer<typeof catalogueGradeSchema>;
export type CatalogueFile = z.infer<typeof catalogueFileSchema>;
