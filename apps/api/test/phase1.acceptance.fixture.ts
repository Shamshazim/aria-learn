import { setImmediate } from 'node:timers/promises';

import request, { type Response } from 'supertest';
import { z } from 'zod';

import {
  PROTOCOL_VERSION,
  arrivalResponseSchema,
  sessionStartResponseSchema,
  turnResponseSchema,
  type Grade,
  type ArrivalResponse,
  type SessionStartResponse,
  type TutorMove,
  type TurnResponse,
} from '@aria/shared';

import { createAiClient, type SpendService } from '@/ai';
import type { LlmProvider, LlmRequest, LlmResponse } from '@/ai/provider';
import { createApp } from '@/app';
import { loadConfig } from '@/config';
import type { IdGenerator } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { createPhase1Runtime } from '@/phase1/runtime';
import { createParentRepository } from '@/repositories/parent.repository';
import { createStudentRepository } from '@/repositories/student.repository';

import { databaseUrl } from './db.harness';

import type { TestDatabase } from './db.harness';
import type { Express } from 'express';

const START = new Date('2026-08-24T20:00:00.000Z');

export async function createPhase1Fixture(
  database: TestDatabase,
  grade: Grade,
  ids: IdGenerator,
): Promise<Phase1Fixture> {
  const clock = mutableClock(START);
  const parents = createParentRepository({ db: database.pool, ids });
  const students = createStudentRepository({ db: database.pool, ids });
  const parent = await parents.insert({
    email: `${ids.next()}@example.test`,
    displayName: 'Parent',
  });
  const student = await students.insert({ parentId: parent.id, displayName: 'Sam', grade });
  const spend = noSpend();
  const config = loadConfig(
    { NODE_ENV: 'test', DATABASE_URL: requiredDatabaseUrl(), LOG_LEVEL: 'silent' },
    'test',
  );
  const logger = createLogger({ level: 'silent' });
  const background = trackedBackgroundTasks();
  const phase1 = await createPhase1Runtime({
    pool: database.pool,
    ai: createAiClient({ provider: recordedProvider(), accounting: spend, now: () => 0 }),
    spend,
    config,
    ids,
    clock,
    logger,
    access: { resolve: () => Promise.resolve({ studentId: student.id }) },
    scheduleBackground: background.schedule,
  });
  return {
    app: createApp({ config, logger, clock, ids, student: phase1.student }),
    studentId: student.id,
    ids,
    clock,
    waitForBackground: background.wait,
  };
}

type MutableClock = Readonly<{ now(): Date; advance(milliseconds: number): void }>;
export type Phase1Fixture = Readonly<{
  app: Express;
  studentId: string;
  ids: IdGenerator;
  clock: MutableClock;
  waitForBackground(): Promise<void>;
}>;

export async function startSession(
  fixture: Phase1Fixture,
  grade: Grade,
  subject: string,
): Promise<SessionStartResponse> {
  const response = await request(fixture.app)
    .post('/api/v1/student/session')
    .send({ subject, grade, fromRecommendation: false })
    .expect(200);
  return parseEnvelope(sessionStartResponseSchema, response);
}

export async function sendTurn(
  fixture: Phase1Fixture,
  sessionId: string,
  payload: Readonly<Record<string, unknown>>,
): Promise<TurnResponse> {
  const response = await request(fixture.app)
    .post('/api/v1/student/session/turn')
    .send({
      protocolVersion: PROTOCOL_VERSION,
      sessionId,
      event: {
        id: fixture.ids.next(),
        at: fixture.clock.now().toISOString(),
        protocolVersion: PROTOCOL_VERSION,
        sessionId,
        ...payload,
      },
    });
  if (response.status !== 200) {
    throw new Error(`turn returned ${String(response.status)}: ${response.text}`);
  }
  return parseEnvelope(turnResponseSchema, response);
}

export function parseArrival(response: Response): ArrivalResponse {
  return parseEnvelope(arrivalResponseSchema, response);
}

export function requireAsk(moves: readonly TutorMove[]): Extract<TutorMove, { kind: 'ASK' }> {
  const ask = moves.find((move) => move.kind === 'ASK');
  if (ask?.kind !== 'ASK') throw new Error('Expected the tutor to continue with an ASK');
  return ask;
}

export async function waitForFact(database: TestDatabase, studentId: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await database.pool.query<{ id: string }>(
      'SELECT id FROM learner_fact WHERE student_id = $1 ORDER BY last_confirmed_at DESC LIMIT 1',
      [studentId],
    );
    if (result.rows[0] !== undefined) return result.rows[0].id;
    await setImmediate();
  }
  throw new Error('Consolidation did not write an evidence-backed fact');
}

function parseEnvelope<Output>(schema: z.ZodType<Output>, response: Response): Output {
  return z.object({ data: schema }).parse(JSON.parse(response.text)).data;
}

function mutableClock(start: Date) {
  let current = start;
  return {
    now: () => current,
    advance: (milliseconds: number) => {
      current = new Date(current.getTime() + milliseconds);
    },
  };
}

function noSpend(): SpendService {
  return {
    assertWithinCap: () => Promise.resolve(),
    record: () => Promise.resolve(),
    recordCachedHit: () => Promise.resolve(),
    report: () => Promise.resolve({ totalTodayUsd: 0, studentsAtCap: 0, students: [] }),
  };
}

function trackedBackgroundTasks(): Readonly<{
  schedule(task: () => Promise<void>): void;
  wait(): Promise<void>;
}> {
  const pending: Promise<void>[] = [];
  return {
    schedule: (task) => {
      pending.push(task());
    },
    wait: async () => {
      await Promise.all(pending);
    },
  };
}

function recordedProvider(): LlmProvider {
  const complete = (input: LlmRequest): Promise<LlmResponse> => Promise.resolve(responseFor(input));
  return {
    complete,
    stream: async function* (input) {
      yield { kind: 'complete', response: await complete(input) } as const;
    },
  };
}

function responseFor(request: LlmRequest): LlmResponse {
  const name = request.accounting?.promptName;
  const data =
    name === 'memory-proposals'
      ? { proposals: [] }
      : name === 'practice-item'
        ? { prompt: 'What word is cat?', answer: 'cat' }
        : name === 'explain'
          ? {
              explanation: request.user.includes('visual-model')
                ? 'Look at four. Count three more.'
                : 'Start at four. Add three.',
            }
          : name === 'hint'
            ? { hint: 'Look and count again.' }
            : { verdict: 'safe' };
  return {
    text: JSON.stringify(data),
    endpointName: 'recorded',
    model: 'recorded',
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
    latencyMs: 0,
    finishReason: 'stop',
  };
}

function requiredDatabaseUrl(): string {
  const url = databaseUrl();
  if (url === undefined) throw new Error('DATABASE_URL is required for Phase 1 acceptance');
  return url;
}
