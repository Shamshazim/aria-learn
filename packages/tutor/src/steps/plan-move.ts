import type { MoveKind, TutorInputEvent } from '@aria/shared';

import { isPlannerApproach } from '../policy/approaches';

import type {
  LoadedTurnContext,
  MovePlan,
  PlannerObservation,
  PlanSource,
  PolicyDecision,
  TutorPorts,
} from '../types';

/** Used when no band budget is supplied. A turn never waits longer than this on judgement. */
export const DEFAULT_PLANNER_BUDGET_MS = 900;

const TIMED_OUT = Symbol('planner-budget-expired');

type PlanInput<TModelContext> = Readonly<{
  ports: TutorPorts<TModelContext>;
  context: LoadedTurnContext<TModelContext>;
  event: TutorInputEvent;
  decision: PolicyDecision;
}>;

type Proposal = Readonly<{ kind: MoveKind; approach: string }>;

type Settlement = Readonly<{
  proposed: Proposal | null;
  /** The proposal, when it was accepted. Absent means the policy's own plan is used. */
  plan?: MovePlan;
  reason: string | null;
  ms: number;
  rejected?: boolean;
}>;

/**
 * Ask the planner for the next move, and hold it to the policy's set (P2H-06).
 *
 * Three things can happen and all three are recorded: the planner proposes something allowed
 * and it is used; it proposes something outside the set and is overruled; or it is not asked,
 * or does not answer in time, and the policy's plan stands. The child never waits for the
 * difference — the budget is enforced here, not in the port.
 */
export async function planMove<TModelContext>(input: PlanInput<TModelContext>): Promise<MovePlan> {
  const skipped = skipReason(input.decision);
  if (skipped !== null) return settle(input, { proposed: null, reason: skipped, ms: 0 });
  const started = input.ports.nowMs();
  const result = await propose(input);
  const ms = Math.max(0, input.ports.nowMs() - started);
  if ('reason' in result) return settle(input, { proposed: null, reason: result.reason, ms });
  const proposed: Proposal = { kind: result.plan.kind, approach: result.plan.approach };
  if (matchesDefault(input.decision.defaultPlan, proposed)) {
    return settle(input, { proposed, reason: 'planner_kept_default', ms });
  }
  const rejection = rejectionFor(input.decision, proposed);
  if (rejection !== null) {
    return settle(input, { proposed, reason: rejection, ms, rejected: true });
  }
  return settle(input, { proposed, plan: result.plan, reason: null, ms });
}

function skipReason(decision: PolicyDecision): string | null {
  if (decision.decisive) return 'policy_decisive';
  if (decision.allowedMoves.length <= 1) return 'single_allowed_move';
  return null;
}

function matchesDefault(defaultPlan: MovePlan, proposed: Proposal): boolean {
  return defaultPlan.kind === proposed.kind && defaultPlan.approach === proposed.approach;
}

function rejectionFor(decision: PolicyDecision, proposed: Proposal): string | null {
  if (!decision.allowedMoves.includes(proposed.kind)) return 'not_allowed';
  if (!isPlannerApproach(proposed.kind, proposed.approach)) return 'unknown_approach';
  return null;
}

async function propose<TModelContext>(
  input: PlanInput<TModelContext>,
): Promise<Readonly<{ plan: MovePlan }> | Readonly<{ reason: string }>> {
  const budgetMs =
    input.ports.plannerBudgetMs?.(input.context, input.event) ?? DEFAULT_PLANNER_BUDGET_MS;
  let expired: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<typeof TIMED_OUT>((resolve) => {
    expired = setTimeout(() => {
      resolve(TIMED_OUT);
    }, budgetMs);
  });
  const call = input.ports
    .planMove({
      context: input.context,
      event: input.event,
      allowedMoves: input.decision.allowedMoves,
      fallback: input.decision.defaultPlan,
    })
    .then((plan) => ({ plan }) as const)
    .catch(() => ({ reason: 'planner_error' }) as const);
  try {
    const result = await Promise.race([call, budget]);
    return result === TIMED_OUT ? { reason: 'planner_timeout' } : result;
  } finally {
    clearTimeout(expired);
  }
}

function settle<TModelContext>(input: PlanInput<TModelContext>, settlement: Settlement): MovePlan {
  const accepted = settlement.plan !== undefined;
  const source: PlanSource = accepted
    ? 'planner'
    : settlement.rejected === true
      ? 'planner-rejected'
      : 'policy';
  const observation: PlannerObservation = {
    allowedMoves: input.decision.allowedMoves,
    proposed: settlement.proposed,
    accepted,
    source,
    rationale: settlement.plan?.rationale ?? null,
    reason: settlement.reason,
    ms: settlement.ms,
  };
  input.ports.observePlan?.(observation);
  return finalPlan(input.decision, observation, settlement.plan);
}

function finalPlan(
  decision: PolicyDecision,
  observation: PlannerObservation,
  planned: MovePlan | undefined,
): MovePlan {
  const base = decision.defaultPlan;
  const evidence = { ...base.evidence, ...plannerEvidence(decision, observation) };
  if (planned === undefined) return { ...base, source: observation.source, evidence };
  return {
    ...base,
    kind: planned.kind,
    approach: planned.approach,
    reason: `Planner chose ${planned.kind} (${planned.approach}) over ${base.kind} (${base.approach}).`,
    ...(planned.rationale === undefined ? {} : { rationale: planned.rationale }),
    source: 'planner',
    evidence,
  };
}

/**
 * Every turn says what the planner was allowed to do, what it asked for and what happened.
 * The rationale is written here and nowhere else: it explains a decision to an adult reading
 * the evidence, and it is never rendered to a child.
 */
function plannerEvidence(
  decision: PolicyDecision,
  observation: PlannerObservation,
): Readonly<Record<string, number | string | boolean>> {
  return {
    plannerAllowed: observation.allowedMoves.join(','),
    plannerProposed:
      observation.proposed === null
        ? 'none'
        : `${observation.proposed.kind}:${observation.proposed.approach}`,
    plannerAccepted: observation.accepted,
    plannerSource: observation.source,
    plannerMs: observation.ms,
    policyReasons: decision.reasons.join(','),
    ...(observation.reason === null ? {} : { plannerReason: observation.reason }),
    ...(observation.rationale === null ? {} : { plannerRationale: observation.rationale }),
  };
}
