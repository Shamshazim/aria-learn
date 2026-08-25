import type { TutorInputEvent, TutorMove } from '@aria/shared';

import { applyPolicy } from './steps/apply-policy';
import { emitMoves } from './steps/emit';
import { loadContext } from './steps/load-context';
import { planMove } from './steps/plan-move';
import { recordTurn } from './steps/record';
import { resolveContent } from './steps/resolve-content';
import { updateStateIntent } from './steps/update-state';

import type {
  CommittedTurn,
  PlannedTurn,
  SpeculativeTurn,
  TutorHarness,
  TutorPorts,
} from './types';

export function createTutorHarness<TModelContext>(
  ports: TutorPorts<TModelContext>,
): TutorHarness<TModelContext> {
  const speculate = (event: TutorInputEvent): Promise<SpeculativeTurn<TModelContext>> =>
    speculateTurn(ports, event);
  return {
    speculate,
    handle: async (event, signal) => {
      const started = ports.nowMs();
      return finalizeTurn(ports, event, await speculate(event), {
        ...(signal === undefined ? {} : { signal }),
        startedAt: started,
      });
    },
    finalize: (event, draft, signal) =>
      finalizeTurn(ports, event, draft, signal === undefined ? {} : { signal }),
  };
}

async function speculateTurn<TModelContext>(
  ports: TutorPorts<TModelContext>,
  event: TutorInputEvent,
): Promise<SpeculativeTurn<TModelContext>> {
  const context = await loadContext(ports.loadContext, event);
  const decision = await applyPolicy(ports.applyPolicy, context, event);
  const plan = await planMove({ port: ports.planMove, context, event, decision });
  return { draft: { context, event, decision, plan }, eventFingerprint: fingerprint(event) };
}

async function finalizeTurn<TModelContext>(
  ports: TutorPorts<TModelContext>,
  event: TutorInputEvent,
  draft: SpeculativeTurn<TModelContext>,
  timing: Readonly<{ signal?: AbortSignal; startedAt?: number }>,
): Promise<readonly TutorMove[]> {
  const started = timing.startedAt ?? ports.nowMs();
  const current =
    draft.eventFingerprint === fingerprint(event) ? draft.draft : await respeculate(ports, event);
  const checked = await recheckPolicy(ports, current, event);
  const gateStarted = ports.nowMs();
  const resolved = await resolveContent(ports.resolveContent, checked, timing.signal);
  const gateMs = Math.max(0, ports.nowMs() - gateStarted);
  const turn: CommittedTurn = {
    event,
    decision: checked.decision,
    plan: checked.plan,
    moves: resolved.moves,
    privateEvidence: resolved.privateEvidence,
    spans: { eou_ms: 0, gate_ms: gateMs, e2e_ms: Math.max(0, ports.nowMs() - started) },
  };
  updateStateIntent(turn);
  await recordTurn(ports.commit, turn);
  return emitMoves(ports.emit, resolved.moves);
}

async function respeculate<TModelContext>(
  ports: TutorPorts<TModelContext>,
  event: TutorInputEvent,
): Promise<PlannedTurn<TModelContext>> {
  return (await speculateTurn(ports, event)).draft;
}

async function recheckPolicy<TModelContext>(
  ports: TutorPorts<TModelContext>,
  planned: PlannedTurn<TModelContext>,
  event: TutorInputEvent,
): Promise<PlannedTurn<TModelContext>> {
  const context = await loadContext(ports.loadContext, event);
  const decision = await applyPolicy(ports.applyPolicy, context, event);
  if (sameDecision(planned, decision)) return { ...planned, context, decision, event };
  const plan = await planMove({ port: ports.planMove, context, event, decision });
  return { context, event, decision, plan };
}

function sameDecision<TModelContext>(
  planned: PlannedTurn<TModelContext>,
  decision: PlannedTurn<TModelContext>['decision'],
): boolean {
  return (
    planned.decision.defaultPlan.kind === decision.defaultPlan.kind &&
    planned.decision.graded?.correct === decision.graded?.correct
  );
}

function fingerprint(event: TutorInputEvent): string {
  switch (event.kind) {
    case 'ANSWER':
      return `${event.kind}:${event.text ?? event.choiceId ?? ''}`;
    case 'SPEECH_FINAL':
    case 'SPEECH_PARTIAL':
    case 'QUESTION':
      return `${event.kind}:${event.text}`;
    default:
      return event.kind;
  }
}
