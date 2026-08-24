import { z } from 'zod';

const ENVIRONMENT_REFERENCE = /^\$\{[A-Z_][A-Z0-9_]*\}$/;
const MAX_ENDPOINTS = 32;
const MAX_MODEL_NAME_LENGTH = 128;
const MAX_REFERENCE_LENGTH = 128;
const MAX_URL_LENGTH = 2_048;
const MAX_TOKENS = 1_000_000;
const MAX_TIMEOUT_SECONDS = 300;
const MAX_COST_PER_MTOK = 100_000;

const endpointNameSchema = z.string().trim().min(1).max(64);

export const providerApiKeySchema = z.string().min(1).max(4_096);

const endpointSchema = z.strictObject({
  api: z.enum(['anthropic', 'openai']),
  'base-url': z.url().max(MAX_URL_LENGTH),
  'api-key': z
    .string()
    .max(MAX_REFERENCE_LENGTH)
    .regex(ENVIRONMENT_REFERENCE, 'must be an environment reference such as ${OPENAI_API_KEY}'),
  model: z.string().trim().min(1).max(MAX_MODEL_NAME_LENGTH),
  'max-tokens': z.number().int().positive().max(MAX_TOKENS),
  'timeout-seconds': z.number().positive().max(MAX_TIMEOUT_SECONDS),
  'cost-per-mtok-in': z.number().nonnegative().max(MAX_COST_PER_MTOK),
  'cost-per-mtok-out': z.number().nonnegative().max(MAX_COST_PER_MTOK),
  reasoning: z.boolean().optional(),
});

const routeSchema = z.strictObject({
  endpoint: endpointNameSchema,
  fallback: endpointNameSchema.optional(),
});

const aiShapeSchema = z.strictObject({
  routing: z.strictObject({
    TEACH: routeSchema,
    FAST: routeSchema,
  }),
  endpoints: z
    .record(endpointNameSchema, endpointSchema)
    .refine((endpoints) => Object.keys(endpoints).length <= MAX_ENDPOINTS, {
      message: `must contain at most ${String(MAX_ENDPOINTS)} endpoints`,
    }),
});

const aiSchema = aiShapeSchema.superRefine((ai, context) => {
  for (const tier of ['TEACH', 'FAST'] as const) {
    const route = ai.routing[tier];
    validateEndpointReference(route.endpoint, ['routing', tier, 'endpoint'], ai, context);
    if (route.fallback !== undefined) {
      validateEndpointReference(route.fallback, ['routing', tier, 'fallback'], ai, context);
    }
  }
});

function validateEndpointReference(
  endpointName: string,
  path: (string | number)[],
  ai: z.infer<typeof aiShapeSchema>,
  context: z.RefinementCtx,
): void {
  if (ai.endpoints[endpointName] !== undefined) return;
  context.addIssue({
    code: 'custom',
    message: `Endpoint "${endpointName}" is not configured`,
    path,
  });
}

export const aiConfigSchema = z.strictObject({
  app: z.strictObject({
    ai: aiSchema,
  }),
});

export type AiConfig = z.infer<typeof aiConfigSchema>;
