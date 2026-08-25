import type { Band, Grade, TutorInputEvent, TutorMove } from '@aria/shared';

export type SessionEndReason = 'complete' | 'break' | 'child_left' | 'timeout';
export type SessionActor = 'child' | 'aria' | 'system';

export type TutorSessionRecord = Readonly<{
  id: string;
  studentId: string;
  subject: string;
  grade: Grade;
  band: Band;
  startedAt: Date;
  endedAt: Date | null;
  endReason: SessionEndReason | null;
  plan: Readonly<Record<string, unknown>>;
  summary: string | null;
}>;

export type NewTutorSession = Readonly<{
  studentId: string;
  subject: string;
  grade: Grade;
  band: Band;
  plan?: Readonly<Record<string, unknown>>;
}>;

export type SessionEventRecord = Readonly<{
  id: string;
  sessionId: string;
  seq: number;
  at: Date;
  actor: SessionActor;
  kind: string;
  text: string | null;
  skillCode: string | null;
  correct: boolean | null;
  latencyMs: number | null;
  evidence: Readonly<Record<string, unknown>>;
  payload: TutorInputEvent | TutorMove | Readonly<Record<string, unknown>>;
}>;

export type NewSessionEvent = Omit<SessionEventRecord, 'id' | 'seq' | 'at'> &
  Readonly<{ at?: Date }>;

export type ArrivalEventRecord = Readonly<{
  id: string;
  studentId: string;
  at: Date;
  welcomeKind: string;
  recommendation: Readonly<Record<string, unknown>> | null;
  accepted: boolean | null;
  latencyMs: number | null;
}>;
