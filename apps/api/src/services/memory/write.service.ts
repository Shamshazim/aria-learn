import type { LearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import type { MemoryProposal } from '@/services/memory/propose/from-events';
import type { LearnerFact, NewLearnerFact, Observation } from '@/types/memory';

export type MemoryWriteService = Readonly<{
  observation(
    input: Readonly<{ studentId: string; proposal: MemoryProposal; at: Date; expiresAt: Date }>,
  ): Promise<Observation>;
  fact(
    input: Readonly<{
      studentId: string;
      proposal: MemoryProposal;
      at: Date;
      previous: LearnerFact | null;
    }>,
  ): Promise<LearnerFact>;
}>;

export function createMemoryWriteService(memory: LearnerMemoryRepository): MemoryWriteService {
  return {
    observation: (
      input: Readonly<{ studentId: string; proposal: MemoryProposal; at: Date; expiresAt: Date }>,
    ) =>
      memory.insertObservation({
        studentId: input.studentId,
        at: input.at,
        skillCode: input.proposal.skillCode,
        kind: input.proposal.kind,
        note: input.proposal.text,
        confidence: input.proposal.confidence,
        expiresAt: input.expiresAt,
        sourceEventId: input.proposal.sourceEventId,
      }),
    fact: (
      input: Readonly<{
        studentId: string;
        proposal: MemoryProposal;
        at: Date;
        previous: LearnerFact | null;
      }>,
    ) => writeFact(memory, input),
  };
}

function writeFact(
  memory: LearnerMemoryRepository,
  input: Readonly<{
    studentId: string;
    proposal: MemoryProposal;
    at: Date;
    previous: LearnerFact | null;
  }>,
): Promise<LearnerFact> {
  const fact: NewLearnerFact = {
    studentId: input.studentId,
    kind: input.proposal.kind,
    value: { text: input.proposal.text, skillCode: input.proposal.skillCode },
    confidence: input.proposal.confidence,
    firstObservedAt: input.at,
    lastConfirmedAt: input.at,
    expiresAt: null,
    sensitivity: 'normal',
    modelShareable: true,
    evidence: [{ sourceKind: 'session_event', sourceId: input.proposal.sourceEventId }],
  };
  return input.previous === null
    ? memory.insertFact(fact)
    : memory.supersede(input.previous.id, fact);
}
