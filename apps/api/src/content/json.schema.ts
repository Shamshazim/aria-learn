import { z } from 'zod';

export const jsonValueSchema = z.json();
export type JsonValue = z.infer<typeof jsonValueSchema>;

export function toJsonValue(value: unknown): JsonValue {
  return jsonValueSchema.parse(value);
}
