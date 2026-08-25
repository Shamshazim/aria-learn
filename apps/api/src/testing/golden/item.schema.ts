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

export const goldenItemSchema = z
  .object({
    id: z.string().min(1),
    subject: z.enum(['arithmetic', 'reading', 'writing']),
    skillCode: z.string().min(1),
    band: z.enum(['early', 'middle', 'senior']),
    promptName: z.literal('practice-item'),
    input: z.object({
      skill: z.string().min(1),
      difficulty: z.enum(['easier', 'same', 'harder']),
    }),
    expectation: z.object({
      arithmeticProblem: arithmeticProblemSchema.optional(),
      expectedAnswer: z.string().min(1).optional(),
      decodablePattern: z.literal('cvc').optional(),
      multipleChoice: z.literal(true).optional(),
    }),
    humanReview: humanReviewSchema,
  })
  .strict();

export const goldenItemGroupSchema = z.array(goldenItemSchema).min(1).max(100);
