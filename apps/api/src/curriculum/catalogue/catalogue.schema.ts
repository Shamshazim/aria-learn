import { z } from 'zod';

/**
 * The shape of one curriculum file: subject → grades → units → lessons → topics, each topic
 * with its learning objectives. It is the shape `legacy/backend` shipped, kept so the four
 * legacy files stay byte-for-byte copies; the California-aligned files that fill TK–8 use the
 * same shape, with `level` allowed to be `"TK"` or `"K"` because those grades have no number.
 *
 * Nothing here is renamed or trimmed on the way in, so a parent who knew the old app finds the
 * same units and lessons in this one.
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

/** A grade number for 1–8, or the two grades the product serves that have none. */
export const catalogueLevelSchema = z.union([z.number().int().min(1).max(8), z.enum(['TK', 'K'])]);

export const catalogueGradeSchema = z
  .object({
    name,
    level: catalogueLevelSchema,
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
export type CatalogueLevel = z.infer<typeof catalogueLevelSchema>;
export type CatalogueFile = z.infer<typeof catalogueFileSchema>;
