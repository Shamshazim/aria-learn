import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { gradeSchema, tutorInputEventSchema, tutorMoveSchema } from '@aria/shared';

const boundedIdSchema = z.string().min(1).max(128);

const learnerFactSchema = z.strictObject({
  id: boundedIdSchema,
  claim: z.string().min(1).max(500),
  evidenceIds: z.array(boundedIdSchema).max(10).default([]),
});

const affectObservationSchema = z.strictObject({
  id: boundedIdSchema,
  claim: z.string().min(1).max(500),
  confidence: z.enum(['low', 'high']),
});

const expectedFactAssertionSchema = z.strictObject({
  eventId: boundedIdSchema,
  factId: boundedIdSchema,
});

const expectedAffectCheckInSchema = z.strictObject({
  eventId: boundedIdSchema,
  observationId: boundedIdSchema,
});

export const turnEvidenceSchema = z.strictObject({
  approachId: boundedIdSchema.optional(),
  assertedFactIds: z.array(boundedIdSchema).max(32).default([]),
  affectClaims: z
    .array(z.strictObject({ observationId: boundedIdSchema, moveId: boundedIdSchema }))
    .max(16)
    .default([]),
  responseOrigin: z.enum(['scripted', 'model', 'crisis_path']).default('scripted'),
  crisisRouted: z.boolean().default(false),
});

const tutoringScenarioShapeSchema = z.strictObject({
  id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
    .max(64),
  title: z.string().min(1).max(120),
  grade: gradeSchema,
  description: z.string().min(1).max(500),
  context: z.strictObject({
    answerOutcomes: z
      .array(z.strictObject({ eventId: boundedIdSchema, outcome: z.enum(['correct', 'wrong']) }))
      .max(32)
      .default([]),
    learnerFacts: z.array(learnerFactSchema).max(32).default([]),
    affectObservations: z.array(affectObservationSchema).max(16).default([]),
    expectedFactAssertions: z.array(expectedFactAssertionSchema).max(16).default([]),
    expectedAffectCheckIns: z.array(expectedAffectCheckInSchema).max(16).default([]),
    safetyDisclosureEventIds: z.array(boundedIdSchema).max(16).default([]),
  }),
  steps: z
    .array(
      z.strictObject({
        event: tutorInputEventSchema,
        scripted: z.strictObject({
          moves: z.array(tutorMoveSchema).max(8),
          stopMoveIds: z.array(boundedIdSchema).max(8).default([]),
          evidence: turnEvidenceSchema,
        }),
      }),
    )
    .min(2)
    .max(64),
});

type ScenarioShape = z.infer<typeof tutoringScenarioShapeSchema>;

function validateFactExpectations(
  scenario: ScenarioShape,
  events: ReadonlyMap<string, ScenarioShape['steps'][number]['event']>,
  facts: ReadonlySet<string>,
  context: z.RefinementCtx,
): void {
  for (const [index, expectation] of scenario.context.expectedFactAssertions.entries()) {
    if (!events.has(expectation.eventId)) {
      context.addIssue({
        code: 'custom',
        message: 'Expected fact assertion must reference a scenario event.',
        path: ['context', 'expectedFactAssertions', index, 'eventId'],
      });
    }
    if (!facts.has(expectation.factId)) {
      context.addIssue({
        code: 'custom',
        message: 'Expected fact assertion must reference a learner fact.',
        path: ['context', 'expectedFactAssertions', index, 'factId'],
      });
    }
  }
}

function validateAffectExpectations(
  scenario: ScenarioShape,
  events: ReadonlyMap<string, ScenarioShape['steps'][number]['event']>,
  observations: ReadonlyMap<string, ScenarioShape['context']['affectObservations'][number]>,
  context: z.RefinementCtx,
): void {
  for (const [index, expectation] of scenario.context.expectedAffectCheckIns.entries()) {
    if (!events.has(expectation.eventId)) {
      context.addIssue({
        code: 'custom',
        message: 'Expected affect check-in must reference a scenario event.',
        path: ['context', 'expectedAffectCheckIns', index, 'eventId'],
      });
    }
    if (observations.get(expectation.observationId)?.confidence !== 'low') {
      context.addIssue({
        code: 'custom',
        message: 'Expected affect check-in must reference a low-confidence observation.',
        path: ['context', 'expectedAffectCheckIns', index, 'observationId'],
      });
    }
  }
}

function validateScenarioReferences(scenario: ScenarioShape, context: z.RefinementCtx): void {
  const events = new Map(scenario.steps.map((step) => [step.event.id, step.event]));
  for (const [index, answer] of scenario.context.answerOutcomes.entries()) {
    if (events.get(answer.eventId)?.kind === 'ANSWER') continue;
    context.addIssue({
      code: 'custom',
      message: 'Answer outcome must reference an ANSWER event.',
      path: ['context', 'answerOutcomes', index, 'eventId'],
    });
  }
  for (const [index, eventId] of scenario.context.safetyDisclosureEventIds.entries()) {
    if (events.has(eventId)) continue;
    context.addIssue({
      code: 'custom',
      message: 'Safety disclosure must reference a scenario event.',
      path: ['context', 'safetyDisclosureEventIds', index],
    });
  }
  const facts = new Set(scenario.context.learnerFacts.map((fact) => fact.id));
  const observations = new Map(
    scenario.context.affectObservations.map((observation) => [observation.id, observation]),
  );
  validateFactExpectations(scenario, events, facts, context);
  validateAffectExpectations(scenario, events, observations, context);
}

export const tutoringScenarioSchema = tutoringScenarioShapeSchema.superRefine(
  validateScenarioReferences,
);

export type TurnEvidence = z.infer<typeof turnEvidenceSchema>;
export type TutoringScenario = z.infer<typeof tutoringScenarioSchema>;

/** Parses checked-in JSON before it reaches replay or invariant logic. */
export function parseTutoringScenario(input: unknown): TutoringScenario {
  return tutoringScenarioSchema.parse(input);
}

export async function loadTutoringScenarios(
  directory: string,
): Promise<readonly TutoringScenario[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
  return Promise.all(
    filenames.map(async (filename) => {
      const contents = await readFile(path.join(directory, filename), 'utf8');
      const input: unknown = JSON.parse(contents);
      return parseTutoringScenario(input);
    }),
  );
}
