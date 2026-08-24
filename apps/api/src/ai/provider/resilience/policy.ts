import type { AiErrorCategory } from '@/ai/provider/errors';

export type ResilienceLogger = {
  info: (fields: Record<string, unknown>, message: string) => void;
  warn: (fields: Record<string, unknown>, message: string) => void;
};

export type CircuitBreakerConfig = {
  failureThreshold: number;
  cooldownMs: number;
};

export function isAvailabilityCategory(category: AiErrorCategory): boolean {
  return category === 'transport' || category === 'rate_limit' || category === 'timeout';
}
