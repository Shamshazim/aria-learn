# Tickets

The plans turned into work. Read in this order:

1. [`AGENT-INSTRUCTIONS.md`](AGENT-INSTRUCTIONS.md) — how to pick up a ticket and finish it.
2. [`CODE-STANDARDS.md`](CODE-STANDARDS.md) — **binding** on every ticket. TypeScript, the
   300-line rule, separation of concerns, React and Express layering, testing, done.
3. Your ticket.

The plans stay authoritative: [`../master-plan.md`](../master-plan.md) is the product,
[`../cloud-model-layer.md`](../cloud-model-layer.md) is the model layer,
[`../rewrite.md`](../rewrite.md) is what we start from. A ticket that disagrees with a plan
is wrong.

---

## Phase 0 — Foundation

| Id | Track | Depends on | Ticket |
|---|---|---|---|
| P0-01 | Infra | — | [Workspace scaffold](P0-01-workspace-scaffold.md) |
| P0-02 | Shared | 01 | [Shared tutor protocol](P0-02-shared-tutor-protocol.md) |
| P0-03 | Backend | 01 | [API service skeleton](P0-03-api-service-skeleton.md) |
| P0-04 | Backend | 03 | [Database foundation, migration 001](P0-04-database-foundation.md) |
| P0-05 | Frontend | 01 | [Web app scaffold](P0-05-web-app-scaffold.md) |
| P0-06 | Frontend | 05 | [Bring the session UI forward](P0-06-session-ui-carry-forward.md) |
| P0-07 | Frontend | 06 | [Capture the visual baseline](P0-07-visual-baseline.md) |
| P0-08 | Frontend | 02, 06 | [Replace the quiz contract](P0-08-scripted-tutor-source.md) |
| P0-09 | Frontend | 07, 08 | [Render every move in all bands](P0-09-move-rendering-all-bands.md) |
| P0-10 | Backend | 03 | [Provider port and AI config](P0-10-provider-port-and-config.md) |
| P0-11 | Backend | 10 | [OpenAI-compatible adapter](P0-11-openai-compatible-adapter.md) |
| P0-12 | Backend | 10 | [Anthropic adapter](P0-12-anthropic-adapter.md) |
| P0-13 | Backend | 11, 12 | [Routing, retry, fallback, breaker](P0-13-routing-retry-fallback-breaker.md) |
| P0-14 | Backend | 13 | [AiClient and prompt registry](P0-14-ai-client-and-prompts.md) |
| P0-15 | Backend | 04, 13 | [Cost accounting and caps](P0-15-cost-accounting-and-caps.md) |
| P0-16 | Backend | 01 | [Deterministic arithmetic checker](P0-16-arithmetic-checker.md) |
| P0-17 | Backend | 04 | [Initial skill inventory](P0-17-initial-skill-inventory.md) |
| P0-18 | Backend | 14, 16, 17 | [The quality gate](P0-18-quality-gate.md) |
| P0-19 | Backend | 13, 18 | [Streaming with segment gating](P0-19-streaming-segment-gating.md) |
| P0-20 | Backend | 04, 18 | [Content cache and pre-generation](P0-20-content-cache-and-pregeneration.md) |
| P0-21 | Content/QA | 15–18 | [Content golden set](P0-21-content-golden-set.md) |
| P0-22 | Content/QA | 02 | [Tutoring golden set](P0-22-tutoring-golden-set.md) |
| P0-23 | Backend | 03 | [Privacy boundary and scrubber](P0-23-privacy-scrubber.md) |
| P0-24 | Backend | 13, 15 | [Health checks and status route](P0-24-health-and-status.md) |
| P0-25 | FE + BE | 09, 13, 20 | [What the child sees when it fails](P0-25-failure-experience.md) |
| P0-26 | Decision | — | [Identity and accounts](P0-26-decision-identity.md) |
| P0-27 | Shared | 02 | [Voice protocol amendment](P0-27-voice-protocol-amendment.md) |

> **Phase 0 exit:** the four session screens render in all three bands; scripted arrival,
> conversation and interruption render without the old `SessionSource` contract; switching
> model providers is a one-line config change; both golden sets report quality, latency and
> cost with no code change; a test proves no raw streamed token reaches a child-facing
> consumer.

## Phase 1 — The proactive tutor loop, text first

| Id | Track | Depends on | Ticket |
|---|---|---|---|
| P1-01 | Backend | P0-04 | [Session tables](P1-01-session-tables.md) |
| P1-02 | Backend | P0-04 | [Evidence-backed learner facts](P1-02-learner-memory-tables.md) |
| P1-03 | Backend | P0-04, P0-17 | [Skill state and misconceptions](P1-03-skill-state-tables.md) |
| P1-04 | Backend | 01–03 | [Arrival endpoint](P1-04-arrival-endpoint.md) |
| P1-05 | Backend | 01 | [Session lifecycle endpoints](P1-05-session-lifecycle-endpoints.md) |
| P1-06 | Backend | P0-14/18/23/27, 01, 03, 05 | [The tutor loop engine](P1-06-tutor-loop-engine.md) |
| P1-07 | Backend | P0-18, P0-20, 06 | [Content resolution in the turn](P1-07-content-in-the-loop.md) |
| P1-08 | Backend | 03, 06 | [Teaching policies](P1-08-teaching-policies.md) |
| P1-09 | Backend | 01, 02, 06 | [Post-session consolidation](P1-09-consolidation.md) |
| P1-10 | Backend | P0-23, 02, 06 | [Memory retrieval](P1-10-memory-retrieval.md) |
| P1-11 | Frontend | P0-08/09, 05, 06 | [The real tutor source](P1-11-real-tutor-source.md) |
| P1-12 | Frontend | P0-09, 04 | [Arrival in the UI](P1-12-arrival-in-the-ui.md) |
| P1-13 | FE + BE | P0-18, 01 | [Safety layer and crisis routing](P1-13-safety-layer.md) |
| P1-14 | Backend | 06 | [Observability for the Phase 1 bars](P1-14-observability.md) |
| P1-15 | QA | all of Phase 1 | [Phase 1 exit acceptance](P1-15-phase1-exit-acceptance.md) |

> **Phase 1 exit:** Aria greets a returning child from evidence, recommends what to do,
> accepts a different class, and conducts a complete multi-turn session. "I don't get it"
> produces a genuinely different explanation. Tomorrow, she accurately recalls at least one
> supported fact from today.

## Phases 2–7

Outlined with reserved ids in [`BACKLOG.md`](BACKLOG.md). Each phase is written out in full
when the previous phase's exit test passes.

---

## What can run in parallel

Three tracks run concurrently from day one, after P0-01 lands:

```
P0-01 ──┬── P0-03 ── P0-04 ──────────────── P0-15 ─┐
        │      └───── P0-10 ─┬─ P0-11 ─┐           │
        │                    └─ P0-12 ─┴─ P0-13 ─ P0-14 ─ P0-18 ─┬─ P0-19
        │                                                        ├─ P0-20
        │      P0-16 ─────────────────────────────────┘          └─ P0-21
        │      P0-17 ─────────────────────────────────┘
        ├── P0-02 ───────────────┬── P0-08 ── P0-09 ── P0-25
        └── P0-05 ── P0-06 ── P0-07                      P0-22   P0-23   P0-24
                                                          P0-26 (any time)
```

- **Frontend** (P0-05 → P0-09) needs nothing from the backend for all of Phase 0.
- **Model layer** (P0-10 → P0-14) needs nothing from the frontend.
- **P0-16, P0-17, P0-22, P0-23 and P0-26** have almost no dependencies and can start early.
- In Phase 1, P1-01, P1-02 and P1-03 are three independent migrations; P1-11 and P1-12 are
  frontend work that runs alongside the backend loop.

Rules that keep parallel work safe are in
[`AGENT-INSTRUCTIONS.md`](AGENT-INSTRUCTIONS.md) §4.
