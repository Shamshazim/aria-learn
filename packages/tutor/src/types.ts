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

/** Who chose the move that was made (P2H-06). */
export type PlanSource = 'policy' | 'planner' | 'planner-rejected';

export type MovePlan = Readonly<{
  kind: MoveKind;
  approach: string;
  reason: string;
  skillCode: string | null;
  attempt: number;
  /** The planner's one-line justification. Logged as evidence, never shown to a child. */
  rationale?: string;
  source?: PlanSource;
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
  /**
   * The policy has already decided and the planner is skipped: safety, a limit, a ladder rung,
   * a repeated misconception, a stop request, personal information (P2H-06).
   */
  decisive: boolean;
  /** Why this plan, in codes a query can group by. Never shown to a child. */
  reasons: readonly string[];
}>;

/** One planner decision, for evidence and metrics (P2H-06). */
export type PlannerObservation = Readonly<{
  /** The session this decision belongs to, so a log line can be traced to a turn. */
  sessionId: string;
  allowedMoves: readonly MoveKind[];
  proposed: Readonly<{ kind: MoveKind; approach: string }> | null;
  accepted: boolean;
  source: PlanSource;
  rationale: string | null;
  /** Why the proposal was not used, or why none was asked for. */
  reason: string | null;
  /** What the port failed with, when it failed. Never a child's words. */
  error: string | null;
  ms: number;
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
  /**
   * How long the turn may wait for `planMove` before the policy's own plan is used. Enforced
   * here rather than inside the port, so a provider that ignores an abort cannot hold up a
   * child's turn (P2H-06).
   */
  plannerBudgetMs?(context: LoadedTurnContext<TModelContext>, event: TutorInputEvent): number;
  observePlan?(observation: PlannerObservation): void;
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
