import { z } from 'zod';

/**
 * What a move puts on screen.
 *
 * Display content is its own union, separate from the move union, because the same content
 * is shown by different moves: a number line can accompany a `SAY` that explains it or an
 * `ASK` that questions it. Keeping them apart is what stops the move union growing a field
 * per visual type.
 */

const MAX_TEXT = 4000;
const MAX_CHOICES = 8;
const MAX_LABEL = 300;

/** A block of prose. The `markdown` flag stays explicit so nothing is rendered as markup by accident. */
export const textContentSchema = z.object({
  type: z.literal('text'),
  body: z.string().min(1).max(MAX_TEXT),
  markdown: z.boolean().default(false),
});

/**
 * The options for a choice question.
 *
 * `id` is what the child's answer refers to, never the label: a label may be reworded, and
 * two labels may render identically once whitespace is normalised. The first version's
 * grading bugs all came from comparing answers by their display text.
 */
export const choicesContentSchema = z.object({
  type: z.literal('choices'),
  options: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        label: z.string().min(1).max(MAX_LABEL),
      }),
    )
    .min(2)
    .max(MAX_CHOICES),
});

/** Something to look at: a number line, a manipulative, a picture. */
export const visualContentSchema = z.object({
  type: z.literal('visual'),
  visual: z.string().min(1).max(64),
  /** Renderer-specific parameters, validated by the renderer that understands them. */
  params: z.record(z.string(), z.unknown()).default({}),
  alt: z.string().min(1).max(MAX_LABEL),
});

/** Text the child reads, aloud or silently. Phase 4 measures oral reading against it. */
export const passageContentSchema = z.object({
  type: z.literal('passage'),
  body: z.string().min(1).max(MAX_TEXT),
  title: z.string().max(MAX_LABEL).optional(),
});

/** A surface for the child's own working — the senior band's work pad. */
export const workpadContentSchema = z.object({
  type: z.literal('workpad'),
  prompt: z.string().max(MAX_TEXT).optional(),
  mode: z.enum(['scratch', 'answer']).default('scratch'),
});

export const moveContentSchema = z.discriminatedUnion('type', [
  textContentSchema,
  choicesContentSchema,
  visualContentSchema,
  passageContentSchema,
  workpadContentSchema,
]);

export type MoveContent = z.infer<typeof moveContentSchema>;
export type TextContent = z.infer<typeof textContentSchema>;
export type ChoicesContent = z.infer<typeof choicesContentSchema>;
export type VisualContent = z.infer<typeof visualContentSchema>;
export type PassageContent = z.infer<typeof passageContentSchema>;
export type WorkpadContent = z.infer<typeof workpadContentSchema>;

/** A move may show nothing, or several things at once (a passage plus its question). */
export const displaySchema = z.array(moveContentSchema).max(4).default([]);
export type Display = z.infer<typeof displaySchema>;
