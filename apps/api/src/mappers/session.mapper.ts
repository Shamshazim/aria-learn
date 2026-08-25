import { z } from 'zod';

import { bandSchema, parseGrade } from '@aria/shared';

import { unmappableRow } from '@/mappers/row';
import type { ArrivalEventRecord, SessionEventRecord, TutorSessionRecord } from '@/types/session';

export type SessionRow = {
  id: string;
  student_id: string;
  subject: string;
  grade: string;
  band: string;
  started_at: Date;
  ended_at: Date | null;
  end_reason: string | null;
  plan: unknown;
  summary: string | null;
};

export type SessionEventRow = {
  id: string;
  session_id: string;
  seq: number;
  at: Date;
  actor: string;
  kind: string;
  text: string | null;
  skill_code: string | null;
  correct: boolean | null;
  latency_ms: number | null;
  evidence: unknown;
  payload: unknown;
};

export type ArrivalEventRow = {
  id: string;
  student_id: string;
  at: Date;
  welcome_kind: string;
  recommendation: unknown;
  accepted: boolean | null;
  latency_ms: number | null;
};

const endReasonSchema = z.enum(['complete', 'break', 'child_left', 'timeout']);
const actorSchema = z.enum(['child', 'aria', 'system']);

export function toTutorSession(row: SessionRow): TutorSessionRecord {
  const grade = parseGrade(row.grade);
  const band = bandSchema.safeParse(row.band);
  if (grade === null) throw unmappableRow('session', 'grade', row.id);
  if (!band.success) throw unmappableRow('session', 'band', row.id);
  if (!isRecord(row.plan)) throw unmappableRow('session', 'plan', row.id);
  const endReason = row.end_reason === null ? null : endReasonSchema.safeParse(row.end_reason);
  if (endReason !== null && !endReason.success)
    throw unmappableRow('session', 'end_reason', row.id);
  return {
    id: row.id,
    studentId: row.student_id,
    subject: row.subject,
    grade,
    band: band.data,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    endReason: endReason === null ? null : endReason.data,
    plan: row.plan,
    summary: row.summary,
  };
}

export function toSessionEvent(row: SessionEventRow): SessionEventRecord {
  const actor = actorSchema.safeParse(row.actor);
  if (!actor.success) throw unmappableRow('session_event', 'actor', row.id);
  if (!isRecord(row.evidence)) throw unmappableRow('session_event', 'evidence', row.id);
  if (!isRecord(row.payload)) throw unmappableRow('session_event', 'payload', row.id);
  return {
    id: row.id,
    sessionId: row.session_id,
    seq: row.seq,
    at: row.at,
    actor: actor.data,
    kind: row.kind,
    text: row.text,
    skillCode: row.skill_code,
    correct: row.correct,
    latencyMs: row.latency_ms,
    evidence: row.evidence,
    payload: row.payload,
  };
}

export function toArrivalEvent(row: ArrivalEventRow): ArrivalEventRecord {
  if (row.recommendation !== null && !isRecord(row.recommendation)) {
    throw unmappableRow('arrival_event', 'recommendation', row.id);
  }
  return {
    id: row.id,
    studentId: row.student_id,
    at: row.at,
    welcomeKind: row.welcome_kind,
    recommendation: row.recommendation,
    accepted: row.accepted,
    latencyMs: row.latency_ms,
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
