import { z } from 'zod';

import { arithmeticProblemSchema } from '@/quality/arithmetic';

const humanReviewSchema = z
  .object({
    status: z.enum(['pending', 'approved']),
    notes: z.string().min(1),
    reviewer: z.string().min(1).optional(),
    reviewedAt: z.iso.datetime().optional(),
  })
  .superRefine((review, context) => {
    if (review.status !== 'approved') return;
    if (review.reviewer === undefined) {
      context.addIssue({ code: 'custom', path: ['reviewer'], message: 'required for approval' });
    }
    if (review.reviewedAt === undefined) {
      context.addIssue({ code: 'custom', path: ['reviewedAt'], message: 'required for approval' });
    }
  });

/**
 * P2H-10: a case says where its item comes from, and carries what that origin needs.
 *
 * The refinement is the point. A model case without a prompt has nothing to run, and a
 * generator case without an index does not pin anything — either would load happily and then
 * grade nothing, which is the failure a golden set exists to prevent.
 */
export const goldenItemSchema = z
  .object({
    id: z.string().min(1),
    subject: z.enum(['arithmetic', 'reading', 'writing']),
    skillCode: z.string().min(1),
    band: z.enum(['early', 'middle', 'senior']),
    origin: z.enum(['model', 'generator']).default('model'),
    promptName: z.literal('practice-item').optional(),
    input: z
      .object({
        skill: z.string().min(1),
        difficulty: z.enum(['easier', 'same', 'harder']),
      })
      .optional(),
    generatorIndex: z.number().int().min(0).max(10_000).optional(),
    expectation: z.object({
      arithmeticProblem: arithmeticProblemSchema.optional(),
      expectedAnswer: z.string().min(1).optional(),
      decodablePattern: z.literal('cvc').optional(),
      multipleChoice: z.literal(true).optional(),
    }),
    humanReview: humanReviewSchema,
  })
  .strict()
  .superRefine((item, context) => {
    if (item.origin === 'model' && (item.promptName === undefined || item.input === undefined)) {
      context.addIssue({ code: 'custom', path: ['input'], message: 'model cases need a prompt' });
    }
    if (item.origin === 'generator' && item.generatorIndex === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['generatorIndex'],
        message: 'generator cases need an index',
      });
    }
  });

export const goldenItemGroupSchema = z.array(goldenItemSchema).min(1).max(100);
