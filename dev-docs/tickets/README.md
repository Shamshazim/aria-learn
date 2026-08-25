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

## Phase 2 — Real-time voice

Implemented 2026-08 from the outlines in [`BACKLOG.md`](BACKLOG.md) (P2-02 … P2-09, P2-13,
P2-14). Still open: P2-01 (provider decision), P2-10 (exit), P2-11 (bridges), P2-12 (golden
runs). Those are closed by Phase 2H below.

## Phase 2H — Make Aria human (finish Phase 2)

Written 2026-08-24 after the "why does it sound like a machine" review. The harness is built;
the tutor inside it is stubs and canned strings. Nothing in Phase 3+ is worth building on top
of that, so this phase comes first.

| Id | Track | Depends on | Ticket |
|---|---|---|---|
| P2H-01 | FE + BE | — | [Silence and disengagement escalation](P2H-01-silence-escalation.md) |
| P2H-02 | Backend | — | [Readability gate replaces the vocabulary whitelist](P2H-02-readability-gate.md) |
| P2H-03 | Backend | 02 | [Aria persona and the per-move prompt library](P2H-03-persona-and-move-prompts.md) |
| P2H-04 | Backend | P0-23, 03 | [Conversation context in every prompt](P2H-04-conversation-context.md) |
| P2H-05 | BE + Voice | 03 | [Free conversation: intent classification](P2H-05-free-conversation-intent.md) |
| P2H-06 | Backend | P1-06, 05 | [The real planner](P2H-06-real-planner.md) |
| P2H-07 | BE + Voice | P0-19, 03 | [Sentence-level streaming to speech](P2H-07-sentence-streaming-to-speech.md) |
| P2H-08 | Voice | P2-01 | [Voice identity and prosody](P2H-08-voice-identity-and-prosody.md) |
| P2H-09 | Voice | 07 | [Bridges and backchannels wired](P2H-09-bridges-and-backchannels.md) |
| P2H-10 | BE + Content | P0-16, P0-17 | [Content depth for the initial scope](P2H-10-content-depth.md) |
| P2H-11 | Backend | 03, 04 | [Specific praise, real reveals, honest endings](P2H-11-specific-praise-reveals-endings.md) |
| P2H-12 | FE + BE | P0-26 | [Identity and child sessions, migration 009](P2H-12-identity-and-child-sessions.md) |
| P2H-13 | QA | 01–09, 15, P2-12 | [Voice golden set, browser suite, provider decision](P2H-13-voice-evidence-and-phase2-exit.md) |
| P2H-15 | Voice + BE | 05, 06 | [Speech-to-speech spike and hybrid decision](P2H-15-speech-to-speech-spike.md) |
| P2H-14 | QA | all of 2H | ["Sounds human" acceptance](P2H-14-sounds-human-acceptance.md) |

> **Phase 2H exit:** a human tutor rates ≥90% of responses warm, age-appropriate and useful;
> no sentence is spoken twice in a session; no static fallback reaches a child in a nominal
> session; first audio < 1s p95; the Phase 2 exit gate passes on recorded evidence.

## Phase 3 — Durable relationship memory and engagement

| Id | Track | Depends on | Ticket |
|---|---|---|---|
| P3-01 | Backend | P1-02 | [Episodes, briefs and corrections, migration 010](P3-01-episode-brief-correction-tables.md) |
| P3-02 | Backend | 01, P1-09 | [Consolidation v2](P3-02-consolidation-v2.md) |
| P3-03 | Backend | 01, 02 | [The learner brief](P3-03-learner-brief.md) |
| P3-04 | Backend | P1-03, P0-17 | [Full skill graph and scheduler](P3-04-skill-graph-and-scheduler.md) |
| P3-05 | FE + BE | P1-06, P2H-05 | [Engagement state and check-ins](P3-05-engagement-state.md) |
| P3-06 | Backend | 01 | [The correction path](P3-06-memory-correction-path.md) |
| P3-07 | BE + Content | P2H-10, 04 | [Curriculum expansion, TK–8 arithmetic](P3-07-curriculum-expansion-arithmetic.md) |
| P3-08 | QA | all of Phase 3 | [Phase 3 exit acceptance](P3-08-phase3-exit-acceptance.md) |

## Phase 4 — Reading and writing to the real bar

| Id | Track | Depends on | Ticket |
|---|---|---|---|
| P4-01 | Backend | P1-03 | [Phonics ladder and tables, migration 013](P4-01-phonics-ladder-tables.md) |
| P4-02 | Backend | 01 | [The decodable-text filter](P4-02-decodable-text-filter.md) |
| P4-03 | Backend | 02, P0-20 | [Decodable passages and the reviewed bank](P4-03-decodable-passages.md) |
| P4-04 | Backend | P2-09, 01 | [Oral reading assessment](P4-04-oral-reading-assessment.md) |
| P4-05 | FE + BE | P2H-08, 01 | [Sounds without letters, and blending](P4-05-phonemic-awareness-activities.md) |
| P4-06 | Backend | 04 | [Comprehension](P4-06-comprehension.md) |
| P4-07 | FE + BE | P1-06 | [The writing coach loop, migration 014](P4-07-writing-coach-loop.md) |
| P4-08 | Frontend | 05, 07 | [Reading and writing in the band UIs](P4-08-reading-writing-band-ui.md) |
| P4-09 | QA | all of Phase 4 | [Phase 4 exit acceptance](P4-09-phase4-exit-acceptance.md) |

## Phase 5 — The Primer

| Id | Track | Depends on | Ticket |
|---|---|---|---|
| P5-01 | Backend | P3-02 | [The narrative thread, migration 015](P5-01-narrative-thread.md) |
| P5-02 | Backend | 01, P3-06 | [Consented, current facts only](P5-02-consented-interests.md) |
| P5-03 | FE + BE + Voice | 01, P2H-07 | [The story in the session](P5-03-story-in-the-session.md) |
| P5-04 | QA | all of Phase 5 | [Phase 5 exit acceptance](P5-04-phase5-exit-acceptance.md) |

## Phase 6 — Parent and teacher agents

| Id | Track | Depends on | Ticket |
|---|---|---|---|
| P6-01 | FE + BE | P2H-12 | [Parent app shell](P6-01-parent-app-shell.md) |
| P6-02 | Backend | P3-03 | [Weekly digest, migration 018](P6-02-weekly-digest.md) |
| P6-03 | Backend | P3-01 | [Ask-Aria for parents](P6-03-ask-aria-parents.md) |
| P6-04 | Backend | P3-04 | [Parent goals](P6-04-parent-goals.md) |
| P6-05 | FE + BE | P3-06 | [Transcripts, learner memory and correction UI](P6-05-transcripts-memory-correction-ui.md) |
| P6-06 | Backend | P2H-12 | [Delete means delete, and export](P6-06-delete-means-delete.md) |
| P6-07 | Backend | P1-13 | [Crisis escalation delivery](P6-07-crisis-escalation-delivery.md) |
| P6-08 | FE + BE | 01 | [Teacher: classes, reports, directives, alerts, migration 023](P6-08-teacher-agent.md) |
| P6-09 | QA | all of Phase 6 | [Phase 6 exit acceptance](P6-09-phase6-exit-acceptance.md) |

## Phase 7 — Scale

| Id | Track | Depends on | Ticket |
|---|---|---|---|
| P7-01 | Backend | P2H-10 | [Shared verified content](P7-01-shared-content-expansion.md) |
| P7-02 | Backend | P0-20 | [Cache and pre-generation optimisation](P7-02-cache-and-pregeneration-optimisation.md) |
| P7-03 | Backend | P0-21, P0-22 | [Tier routing tuning](P7-03-tier-routing-tuning.md) |
| P7-04 | Ops | P0-15 | [Cost per child per month](P7-04-cost-per-child.md) |
| P7-05 | QA | all of Phase 7 | [Phase 7 exit acceptance](P7-05-phase7-exit-acceptance.md) |

## Migration map (009 onward)

Numbers are assigned by ticket, not by merge order (`AGENT-INSTRUCTIONS.md` §4).

| # | Ticket | # | Ticket | # | Ticket |
|---|---|---|---|---|---|
| 009 | P2H-12 identity | 016 | P5-02 story consent | 023 | P6-08 teacher |
| 010 | P3-01 episodes/briefs | 017 | P6-01 student controls | 024 | P7-01 shared content |
| 011 | P3-02 rebuild shadow | 018 | P6-02 parent_digest | 025 | P7-02 pregeneration_job |
| 012 | P3-04 scheduler columns | 019 | P6-03 parent_ask | 026 | P7-04 voice cost |
| 013 | P4-01 phonics | 020 | P6-04 learner_goal | 027 | X-02 subscription |
| 014 | P4-07 child_writing | 021 | P6-06 deletion tombstone | 028 | X-05 idempotency |
| 015 | P5-01 narrative | 022 | P6-07 escalation/contacts | 000 | X-01 migration ledger |

## Cross-cutting

Not phase-bound. X-01 is needed before any real family uses the product; X-02 before anyone
pays; the rest before public launch.

| Id | Track | Depends on | Ticket |
|---|---|---|---|
| X-01 | Infra | — | [Deployment and CI](X-01-deployment.md) |
| X-02 | Decision + BE | P2H-12 | [Signup, subscription and billing](X-02-signup-subscription-billing.md) |
| X-03 | Frontend | P2-07 | [Device and accessibility matrix](X-03-device-and-accessibility-matrix.md) |
| X-04 | Ops | P1-14 | [Load, latency SLOs and alerting](X-04-load-latency-slos-alerting.md) |
| X-05 | Backend | P1-13 | [Abuse and robustness](X-05-abuse-and-robustness.md) |
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
