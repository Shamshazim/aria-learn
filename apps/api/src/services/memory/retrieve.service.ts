import type { Clock } from '@/lib/clock';
import type { RawDialogueTurn, ScrubbedContext } from '@/privacy';
import type { LearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import { toScrubbedContext } from '@/services/memory/present/to-context';
import { applyTokenBudget, estimateTokens } from '@/services/memory/relevance/budget';
import { rankRelevantFacts } from '@/services/memory/relevance/rules';

export type MemoryRetrieval = Readonly<{
  context: ScrubbedContext;
  estimatedTokens: number;
  factIds: readonly string[];
}>;

export type MemoryRetrievalService = Readonly<{
  retrieve(
    input: Readonly<{
      sessionId: string;
      studentId: string;
      band: string;
      skillCode: string | null;
      identifiers: Parameters<typeof toScrubbedContext>[0]['identifiers'];
      recentEvidence?: readonly string[];
      recentDialogue?: readonly RawDialogueTurn[];
      shareFirstName?: boolean;
    }>,
  ): Promise<MemoryRetrieval>;
}>;

export function createMemoryRetrievalService(deps: {
  memory: LearnerMemoryRepository;
  clock: Clock;
  maxTokens: number;
  recordSize(input: Readonly<{ sessionId: string; tokens: number }>): void;
  /**
   * P3-03: this week's learner brief, or `null`. Absent or `null`, the context is facts only —
   * never an empty string a prompt might quote.
   */
  brief?(studentId: string, now: Date): Promise<string | null>;
}): MemoryRetrievalService {
  return {
    retrieve: (
      input: Readonly<{
        sessionId: string;
        studentId: string;
        band: string;
        skillCode: string | null;
        identifiers: Parameters<typeof toScrubbedContext>[0]['identifiers'];
        recentEvidence?: readonly string[];
      }>,
    ) => retrieve(deps, input),
  };
}

async function retrieve(
  deps: Parameters<typeof createMemoryRetrievalService>[0],
  input: Readonly<{
    sessionId: string;
    studentId: string;
    band: string;
    skillCode: string | null;
    identifiers: Parameters<typeof toScrubbedContext>[0]['identifiers'];
    recentEvidence?: readonly string[];
    recentDialogue?: readonly RawDialogueTurn[];
    shareFirstName?: boolean;
  }>,
): Promise<MemoryRetrieval> {
  const now = deps.clock.now();
  const [facts, brief] = await Promise.all([
    deps.memory.listCurrent(input.studentId, now),
    deps.brief?.(input.studentId, now) ?? Promise.resolve(null),
  ]);
  const ranked = rankRelevantFacts(facts, { skillCode: input.skillCode, now });
  const evidenceTokens = (input.recentEvidence ?? []).reduce(
    (total, item) => total + estimateTokens(item),
    0,
  );
  const budgeted = applyTokenBudget(ranked, Math.max(0, deps.maxTokens - evidenceTokens));
  const estimatedTokens = evidenceTokens + budgeted.estimatedTokens;
  deps.recordSize({ sessionId: input.sessionId, tokens: estimatedTokens });
  return {
    context: toScrubbedContext({
      band: input.band,
      skillCode: input.skillCode,
      facts: budgeted.facts,
      identifiers: input.identifiers,
      ...(input.recentEvidence === undefined ? {} : { recentEvidence: input.recentEvidence }),
      ...(input.recentDialogue === undefined ? {} : { recentDialogue: input.recentDialogue }),
      ...(input.shareFirstName === undefined ? {} : { shareFirstName: input.shareFirstName }),
      ...(brief === null ? {} : { brief }),
    }),
    estimatedTokens,
    factIds: budgeted.facts.map((item) => item.fact.id),
  };
}
