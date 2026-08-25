import { z } from 'zod';

export const arrivalRequestSchema = z.object({}).strict();
export type ArrivalRequest = z.infer<typeof arrivalRequestSchema>;
