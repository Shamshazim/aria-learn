import type { Band, Grade, MoveKind, TutorInputEvent, TutorMove } from '@aria/shared';

export type SessionSnapshot = Readonly<{
  id: string;
  studentId: string;
  subject: string;
  grade: Grade;
  band: Band;
  skillCode: string | null;
  startedAt: Date;
  attempts: number;
  consecutiveWrong: number;
  /** `SILENCE` events since the child last did anything (P2H-01). */
  consecutiveSilences: number;
  repeatedMisconception: string | null;
  lastApproach: string | null;
  unmetPrerequisite: string | null;
}>;

export type LoadedTurnContext<TModelContext> = Readonly<{
  session: SessionSnapshot;
  modelContext: TModelContext;
  recentKinds: readonly string[];
}>;

export type MovePlan = Readonly<{
  kind: MoveKind;
  approach: string;
  reason: string;
  skillCode: string | null;
  attempt: number;
  /**
   * Why the policy chose this, in a form a query can read — the silence rung, later the
   * planner's allowed set and rationale (P2H-06). It is written to `session_event.evidence`
   * and never shown to a child.
   */
  evidence?: Readonly<Record<string, number | string | boolean>>;
}>;

export type PolicyDecision = Readonly<{
  allowedMoves: readonly MoveKind[];
  defaultPlan: MovePlan;
  graded: Readonly<{ correct: boolean; misconception: string | null }> | null;
  terminal: boolean;
}>;

export type PlannedTurn<TModelContext> = Readonly<{
  context: LoadedTurnContext<TModelContext>;
  event: TutorInputEvent;
  decision: PolicyDecision;
  plan: MovePlan;
}>;

export type CommittedTurn = Readonly<{
  event: TutorInputEvent;
  decision: PolicyDecision;
  plan: MovePlan;
  moves: readonly TutorMove[];
  privateEvidence: Readonly<Record<string, unknown>>;
  spans: Readonly<Record<string, number>>;
}>;

export type ResolvedContent = Readonly<{
  moves: readonly TutorMove[];
  privateEvidence: Readonly<Record<string, unknown>>;
}>;

export type TutorPorts<TModelContext> = Readonly<{
  loadContext(event: TutorInputEvent): Promise<LoadedTurnContext<TModelContext>>;
  applyPolicy(
    context: LoadedTurnContext<TModelContext>,
    event: TutorInputEvent,
  ): Promise<PolicyDecision>;
  planMove(
    input: Readonly<{
      context: LoadedTurnContext<TModelContext>;
      event: TutorInputEvent;
      allowedMoves: readonly MoveKind[];
      fallback: MovePlan;
    }>,
  ): Promise<MovePlan>;
  resolveContent(input: PlannedTurn<TModelContext>, signal?: AbortSignal): Promise<ResolvedContent>;
  commit(turn: CommittedTurn): Promise<void>;
  emit(moves: readonly TutorMove[]): Promise<readonly TutorMove[]>;
  nowMs(): number;
}>;

export type SpeculativeTurn<TModelContext> = Readonly<{
  draft: PlannedTurn<TModelContext>;
  eventFingerprint: string;
}>;

export type TutorHarness<TModelContext> = Readonly<{
  handle(event: TutorInputEvent, signal?: AbortSignal): Promise<readonly TutorMove[]>;
  speculate(event: TutorInputEvent): Promise<SpeculativeTurn<TModelContext>>;
  finalize(
    event: TutorInputEvent,
    draft: SpeculativeTurn<TModelContext>,
    signal?: AbortSignal,
  ): Promise<readonly TutorMove[]>;
}>;
