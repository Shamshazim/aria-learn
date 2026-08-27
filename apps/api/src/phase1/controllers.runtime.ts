import {
  PROTOCOL_VERSION,
  sessionIdSchema,
  turnResponseSchema,
  type TurnRequest,
  type TurnResponse,
} from '@aria/shared';

import { createArrivalController } from '@/controllers/arrival.controller';
import { createSessionControllers } from '@/controllers/session.controller';
import { ForbiddenError, ValidationError } from '@/errors';
import type { QualityGate } from '@/quality';
import type { RouterDeps } from '@/routes';
import { createArrivalService } from '@/services/arrival/arrival.service';
import { createArrivalContextLoader } from '@/services/arrival/context.loader';
import { createConsolidationService } from '@/services/memory/consolidate.service';
import { createModelFactProposer } from '@/services/memory/propose/from-model';
import { createMoveFactory } from '@/services/moves/move-factory';
import { createEndService } from '@/services/session/end.service';
import { createResumeService } from '@/services/session/resume.service';
import { createSessionService } from '@/services/session/session.service';
import type { createCrisisTurnService } from '@/services/tutor/crisis-turn.service';
import { turnMoves } from '@/services/tutor/safety-first';
import type { createTutorService } from '@/services/tutor/tutor.service';

import { createIdentityRuntime, type IdentityRuntime } from './identity.runtime';

import type { Phase1Repositories, Phase1RuntimeDeps } from './runtime.types';

type ControllerRuntime = Readonly<{
  deps: Phase1RuntimeDeps;
  repositories: Phase1Repositories;
  tutor: ReturnType<typeof createTutorService>;
  crisis: ReturnType<typeof createCrisisTurnService>;
  gate: QualityGate;
  /** P2H-11: the display name of a skill, for the summary written when a session ends. */
  skillName(skillCode: string): string | null;
  cancelAhead(sessionId: string): void;
}>;

export function buildPhase1Controllers(runtime: ControllerRuntime): Readonly<{
  student: NonNullable<RouterDeps['student']>;
  turn(studentId: string, request: TurnRequest, signal?: AbortSignal): Promise<TurnResponse>;
  identity: IdentityRuntime;
}> {
  const lifecycle = buildLifecycle(runtime);
  // P2H-12: identity is built here because the idle sweep has to be able to end a tutor
  // session, and `end` is the first thing in the graph that can.
  const identity = createIdentityRuntime({
    deps: runtime.deps,
    repositories: runtime.repositories,
    end: lifecycle.end,
  });
  const arrival = buildArrival(runtime, runtime.gate);
  const serialize = createSessionTurnQueue();
  const turn = (studentId: string, request: TurnRequest, signal?: AbortSignal) =>
    serialize(request.sessionId ?? request.event.sessionId ?? 'missing', () =>
      turnResponse({ ...runtime, end: lifecycle.end }, studentId, request, signal),
    );
  return {
    student: {
      authorize: identity.childAuth,
      arrival: createArrivalController(arrival),
      sessions: createSessionControllers({
        sessions: lifecycle.sessions,
        end: lifecycle.end,
        turn,
        logger: runtime.deps.logger,
        ...(runtime.deps.segments === undefined ? {} : { segments: runtime.deps.segments }),
      }),
    },
    turn,
    identity,
  };
}

function createSessionTurnQueue() {
  const tails = new Map<string, Promise<void>>();
  return async <T>(sessionId: string, operation: () => Promise<T>): Promise<T> => {
    const previous = tails.get(sessionId) ?? Promise.resolve();
    let release = (): void => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    tails.set(sessionId, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (tails.get(sessionId) === current) tails.delete(sessionId);
    }
  };
}

function buildLifecycle(runtime: ControllerRuntime) {
  const { deps, repositories } = runtime;
  const consolidation = createConsolidationService({
    events: repositories.events,
    memory: repositories.memory,
    pool: deps.pool,
    clock: deps.clock,
    repetitionsForDurableFact: deps.config.memoryRepetitionsForDurableFact,
    countPriorSignal: (studentId, kind) => repositories.memory.countObservations(studentId, kind),
    modelProposer: createModelFactProposer(deps.ai),
    loadIdentifiers: async (studentId) => {
      const student = await repositories.students.requireById(studentId);
      return { fullName: student.displayName };
    },
  });
  const resume = createResumeService(repositories.events);
  const sessions = createSessionService({
    students: repositories.students,
    sessions: repositories.sessions,
    skills: repositories.skills,
    arrivals: repositories.arrivals,
    clock: deps.clock,
    ids: deps.ids,
    resume: resume.rebuild,
    start: (session, event) => runtime.tutor.handle(session.studentId, event),
  });
  const end = createEndService({
    sessions: repositories.sessions,
    events: repositories.events,
    skillName: runtime.skillName,
    consolidation,
    clock: deps.clock,
    logger: deps.logger,
    schedule: deps.scheduleBackground ?? scheduleBackground,
    cancelAhead: runtime.cancelAhead,
    ...(deps.closeVoiceSession === undefined ? {} : { closeVoiceSession: deps.closeVoiceSession }),
  });
  return { sessions, end: end.end };
}

function scheduleBackground(task: () => Promise<void>): void {
  queueMicrotask(() => {
    void task();
  });
}

function buildArrival(
  runtime: ControllerRuntime,
  gate: Parameters<typeof createArrivalService>[0]['gate'],
) {
  const { deps, repositories } = runtime;
  const context = createArrivalContextLoader({
    students: repositories.students,
    sessions: repositories.sessions,
    events: repositories.events,
    skills: repositories.skills,
    memory: repositories.memory,
    clock: deps.clock,
  });
  return createArrivalService({
    load: context.load,
    arrivals: repositories.arrivals,
    moves: createMoveFactory({ ids: deps.ids, clock: deps.clock }),
    gate,
    nowMs: () => deps.clock.now().getTime(),
  });
}

type TurnRuntime = ControllerRuntime &
  Readonly<{ end: ReturnType<typeof createEndService>['end'] }>;

async function turnResponse(
  runtime: TurnRuntime,
  studentId: string,
  request: TurnRequest,
  signal?: AbortSignal,
): Promise<TurnResponse> {
  const sessionId = request.sessionId ?? request.event.sessionId;
  if (
    sessionId === undefined ||
    (request.event.sessionId !== undefined && request.event.sessionId !== sessionId)
  ) {
    throw new ValidationError('turn session ids must match');
  }
  const session = await runtime.repositories.sessions.findById(sessionId);
  if (session?.studentId !== studentId)
    throw new ForbiddenError('student session ownership mismatch');
  if (session.endedAt !== null) throw new ValidationError('session has already ended');
  const event = { ...request.event, sessionId };
  const moves = await turnMoves(runtime, studentId, event, signal);
  const terminal = moves.find((move) => move.kind === 'END' || move.kind === 'BREAK');
  if (terminal !== undefined) {
    await runtime.end({
      sessionId,
      studentId,
      reason:
        request.event.kind === 'LEAVE'
          ? 'child_left'
          : terminal.kind === 'BREAK'
            ? 'break'
            : 'complete',
    });
  }
  return turnResponseSchema.parse({
    protocolVersion: PROTOCOL_VERSION,
    sessionId: sessionIdSchema.parse(sessionId),
    inResponseTo: request.event.id,
    at: runtime.deps.clock.now().toISOString(),
    moves,
  });
}
