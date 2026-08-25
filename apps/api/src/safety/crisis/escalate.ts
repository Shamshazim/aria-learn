import { ESCALATION_MATRIX } from '@/safety/crisis/matrix';
import type { CrisisCategory, EscalationRoute } from '@/safety/crisis/matrix';

export type EscalationPort = Readonly<{
  notify(
    input: Readonly<{
      studentId: string;
      sessionId: string;
      category: CrisisCategory;
      route: EscalationRoute;
    }>,
  ): Promise<void>;
}>;

export async function escalate(
  port: EscalationPort,
  input: Readonly<{ studentId: string; sessionId: string; category: CrisisCategory }>,
): Promise<EscalationRoute> {
  const route = ESCALATION_MATRIX[input.category].route;
  await port.notify({ ...input, route });
  return route;
}
