# P2H-06 — The real planner

| | |
|---|---|
| **Phase** | 2H |
| **Track** | Backend |
| **Depends on** | P1-06, P2H-05 |
| **Blocks** | P3-04, P3-05, P2H-14 |
| **Parallel-safe with** | P2H-07, P2H-08, P2H-09, P2H-10, P2H-12 |
| **Size** | M |

## Why

`apps/api/src/services/tutor/tutor.service.ts:51` wires
`planMove: ({ fallback }) => Promise.resolve(fallback)`. `packages/tutor/src/steps/plan-move.ts`
is ready to validate a proposal against `allowedMoves`, but `teaching-policy.ts` returns a
single-element allowed set and `policy/allowed-moves.ts` is never called. So there is no
judgement anywhere: every situation has exactly one canned response. `master-plan.md` §4.1
step 3: *ask the planner model for the next allowed move when judgement is required*.

## Scope

### Build
A planner model port implementation, a wider allowed-move set from policy, a decisive-policy
short-circuit, a latency budget, and evidence logging of the decision.

### Do not build
No scheduler (P3-04). No engagement model (P3-05). The planner never generates child-facing
text; it selects a move and an approach.

## Design

```
packages/tutor/src/
  policy/teaching-policy.ts     returns { allowedMoves (from allowed-moves.ts ∩ limits ∩ ladder),
                                defaultPlan, decisive: boolean, reasons[] }
  policy/decisive.ts            when policy is decisive (safety, limits hit, silence ladder,
                                misconception seen twice, STOP_REQUEST, PERSONAL_INFO): skip planner
  steps/plan-move.ts            unchanged contract; adds timeout + rejection reason to result
  types.ts                      MovePlan gains rationale: string, source: 'policy'|'planner'|'planner-rejected'
apps/api/src/ai/planner/
  model-planner.ts              implements TutorPorts.planMove with the TEACH-tier (config) model
  planner.prompt.ts             registered prompt: situation summary + allowed moves + approaches
  planner.schema.ts             { kind, approach, rationale, confidence }
  planner.budget.ts             per band: early 700ms, middle 900ms, senior 1200ms (text);
                                voice channel halves these (speculation on partials covers the rest)
apps/api/src/services/tutor/
  tutor.service.ts              injects model-planner; removes the stub
  planner-evidence.ts           writes { allowedMoves, proposed, accepted, source, rationale, ms }
```

**Approaches** are a closed enum per move (`packages/tutor/src/policy/approaches.ts`):
`HINT: 'point-to-step' | 'worked-similar' | 'narrow-choice'`; `RETEACH: 'visual-model' |
'concrete-story' | 'simpler-case'`; `SAY: 'answer-question' | 'acknowledge-chat' | 'confirm-spoken-answer' | 'teach'`;
`ASK: 'same-item' | 'easier-item' | 'reask-short'`; others `'default'`. The planner chooses
`{kind, approach}`; content generation (P2H-03 prompts) takes the approach as an instruction.

**Rules**
- The planner runs only when `decisive === false` and `allowedMoves.length > 1`.
- A proposal outside `allowedMoves`, or with an unknown approach, is rejected →
  `defaultPlan`, `source: 'planner-rejected'`, counted.
- Timeout → `defaultPlan`, `source: 'policy'`, reason `planner_timeout`.
- The planner prompt receives: band, skill, open item (no answer key), attempts, last 3
  intents, dialogue window (P2H-04), skill-state summary, allowed moves with one-line
  meanings. It never receives the answer key (it must not leak into a rationale).
- Rationale is logged, never shown to the child.

### Edge cases
- Planner proposes `REVEAL` on attempt 1 → not in allowed set (limits) → rejected.
- Planner proposes `PRAISE` for a wrong answer → policy removes `PRAISE` from the set when
  `graded.correct === false`, so it is rejected; test.
- Provider outage / breaker open → `defaultPlan` immediately, no wait.
- Two moves per turn (SAY then ASK from P2H-05) → planner chooses only the first; the
  re-ask is appended by policy.
- Speculative draft on a partial transcript proposes X; final transcript changes intent →
  commit step re-runs policy and discards the draft (P1-06 amendment) — test extended.
- Cost: planner calls counted under `ai_cost` with `purpose: 'plan'`; per-child cap applies.

## Status (2026-08-25)

- **Code complete pending review** on `docs/harness-review-fixes`; no PR yet.
- Done: `policy/approaches.ts` (closed per-move approach enum), `policy/decisive.ts` (the
  reasons that skip the planner), `policy/allowed-set.ts` (event moves ∩ limits ∩ ladder, with
  a table test), the teaching policy split into `outcome.ts` / `intent-policy.ts` /
  `answer-policy.ts` and now returning `{ allowedMoves, defaultPlan, decisive, reasons }`,
  `steps/plan-move.ts` with the band budget raced in the package, validation, rejection reasons
  and evidence, `ai/planner/*` (schema, TEACH-tier `plan-move` prompt, per-band budgets halved
  on the voice channel, the model port), `services/tutor/planner-evidence.ts`
  (`planner_decision_total{source,reason}`, `planner_latency_ms`), the stub removed from
  `tutor.service.ts`, and approach instructions for every approach the planner may choose.
- Deviations from the design block, both deliberate: the prompt lives at
  `ai/planner/planner.prompt.ts` and is registered in the shared prompt registry (the registry
  is the only prompt seam `AiClient` reads), and cost is attributed by `promptName:
  'plan-move'` rather than a new `purpose` column on `ai_cost`. A proposal identical to the
  policy default is recorded as `planner_kept_default`, not as a rejection.
- Remaining: the p95 latency report needs a live provider run, and the golden "repeated
  confusion" rubric line is a human judgement in `dev-docs/golden/tutoring/scores.md`. The
  golden replay injects a declining planner and marks each scripted decision decisive on
  purpose — a replay that called a model would not be a replay — so the approach change that
  rubric line asks about comes from the policy's own `nextApproach`, not from the planner.

### Review pass (2026-08-25)

A standards/spec review of `f25c84f` found nine things. Fixed in the follow-up commit:

- The planner log line carried no correlation id and did carry the model's `rationale`. It now
  logs `event` and `sessionId`, and the rationale stays in `session_event.evidence` only
  (CODE-STANDARDS §5).
- A failing port was swallowed. `PlannerObservation` gained `error`, and the provider's own
  message is logged.
- `planner_declined` is a reason of its own. A port that hands back the fallback object — a
  disabled provider, or a proposal under the confidence floor — is no longer counted as having
  agreed with the policy. The floor itself is now an option on `createModelPlanner`.
- **A planner-chosen `SWITCH` kept the failing skill.** `plan-move.ts` now redirects it to the
  unmet prerequisite, which is the only reason the allowed set offers `SWITCH` at all.
- The prompt's `recentIntents` was really a list of protocol event kinds. The policy now writes
  the classified intent to the turn evidence and the context loader reads the last three back,
  oldest first — the spec's "last 3 intents".
- `ASK`'s three approaches had no persona instruction, so choosing one changed nothing.
  Written, and `approach-coverage.test.ts` now fails if `PLANNER_APPROACHES` and
  `APPROACH_INSTRUCTIONS` ever disagree again.
- Unused exports removed (`allowedSet`, `isDecisive`, `DECISIVE_REASONS`,
  `DEFAULT_PLANNER_BUDGET_MS`, `isPlannerApproach`, `describeAllowedMoves`); the dead
  `'terminal'` entry is gone from `DECISIVE_REASONS`, since terminality is handled directly.

Deliberately not changed: `unclear` and `low_confidence_speech` stay decisive — asking a model
to weigh a turn nobody understood is exactly the case the short-circuit exists for. The budget
still uses `setTimeout` rather than the injected clock, because it bounds real elapsed time, not
the session's notion of now. The provider timeout equals the raced budget on purpose: the race
frees the child's turn, the timeout frees the connection.

## Acceptance criteria

- [x] `tutor.service.ts` no longer contains the fallback stub; the injected planner is the
      model implementation in prod and a fake in tests.
- [x] Policy returns multi-element allowed sets for ANSWER-wrong, QUESTION, CHAT, CONFUSED,
      SILENCE (rung 1–2) and single-element for decisive cases (table in tests).
- [x] Disallowed proposal → default plan; `source: 'planner-rejected'` recorded.
- [x] Timeout at the band budget → default plan; measured with a fake slow port.
- [x] The answer key never appears in the planner prompt (fixture grep).
- [x] Every turn's evidence contains `allowedMoves`, `proposed`, `accepted`, `source`.
- [ ] Golden tutoring set: "repeated confusion" now shows a different approach on the
      second RETEACH (rubric), and "two wrong answers without a change" remains 0.
- [ ] p95 added latency of the planner on the text channel < band budget (report).

## Verification

```bash
npm run test -w @aria/tutor
npm run test -w @aria/api -- planner
npm run golden:tutoring -w @aria/api
```

## References

- `master-plan.md` §4.1 step 3, §11 teaching quality
- `realtime-agent-harness.md` — "Speculative planning on partials", "Structured move plan"
- P1-06, P1-08
