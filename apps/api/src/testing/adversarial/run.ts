import { replayParentAskFixture, replayRealtimeFixture } from '@/testing/adversarial/boundary';
import {
  INJECTION_INVARIANTS,
  INVARIANT_CLAIMS,
  PARENT_ASK_INVARIANTS,
  REALTIME_INVARIANTS,
  type Invariant,
} from '@/testing/adversarial/invariants';
import { loadAdversarialFixtures, type AdversarialFixtures } from '@/testing/adversarial/load';
import { replayInjectionFixture } from '@/testing/adversarial/turn-path';

/**
 * Every fixture, through its boundary, checked against every invariant (X-05).
 *
 * The report is the deliverable, not the pass/fail. "It went green" says nothing about
 * coverage; a report that names 63 fixtures and 10 invariants is something a person can look
 * at and say "there is no case in here for X" — which is how the suite grows.
 */
export type FixtureResult = Readonly<{
  fixtureId: string;
  family: 'injection' | 'parent-ask' | 'realtime';
  violations: readonly Readonly<{ invariant: string; reason: string }>[];
}>;

export type AdversarialReport = Readonly<{
  passed: boolean;
  fixtureCount: number;
  invariants: typeof INVARIANT_CLAIMS;
  results: readonly FixtureResult[];
}>;

export async function runAdversarialSuite(
  fixtures: AdversarialFixtures = loadAdversarialFixtures(),
): Promise<AdversarialReport> {
  const injection = await Promise.all(
    fixtures.injection.map(async (fixture) =>
      result('injection', fixture, await replayInjectionFixture(fixture), INJECTION_INVARIANTS),
    ),
  );
  const parentAsk = fixtures.parentAsk.map((fixture) =>
    result('parent-ask', fixture, replayParentAskFixture(fixture), PARENT_ASK_INVARIANTS),
  );
  const realtime = fixtures.realtime.map((fixture) =>
    result('realtime', fixture, replayRealtimeFixture(fixture), REALTIME_INVARIANTS),
  );
  const results = [...injection, ...parentAsk, ...realtime];

  return {
    passed: results.every((entry) => entry.violations.length === 0),
    fixtureCount: results.length,
    invariants: INVARIANT_CLAIMS,
    results,
  };
}

function result<Outcome, Fixture extends Readonly<{ id: string }>>(
  family: FixtureResult['family'],
  fixture: Fixture,
  outcome: Outcome,
  invariants: readonly Invariant<Outcome, Fixture>[],
): FixtureResult {
  const violations = invariants
    .map((invariant) => ({ invariant: invariant.id, reason: invariant.check(outcome, fixture) }))
    .filter(
      (entry): entry is Readonly<{ invariant: string; reason: string }> => entry.reason !== null,
    );
  return { fixtureId: fixture.id, family, violations };
}
