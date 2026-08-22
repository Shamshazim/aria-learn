# Backlog — Phases 2 to 7

Phase 0 and Phase 1 are written as full tickets in this folder. Phases 2 onward are recorded
here as scoped outlines, not because they matter less but because writing them in detail now
would be guessing: Phase 2's transport choice depends on Phase 0's measured latency, and
Phase 3's memory shape depends on what Phase 1's consolidation actually produces.

**Each phase's tickets are written out in full when the previous phase's exit test passes.**
Ids are reserved here so the numbering stays stable.

---

## Phase 2 — Real-time voice

Non-negotiable for TK–2: a five-year-old cannot read the interface of a reading tutor.

| Id | Track | Scope |
|---|---|---|
| P2-01 | Decision | Speech and real-time provider selection, judged on measured latency, interruption, accuracy, safety and cost (`cloud-model-layer.md` §14). |
| P2-02 | Backend | The product-owned live protocol: WebRTC preferred for audio, WebSocket for events or fallback. Vendor APIs stay behind the speech and model ports. |
| P2-03 | Backend | `POST /session/{id}/realtime` negotiation and short-lived credentials. |
| P2-04 | Backend | Streaming TTS through P0-19's segment gate. Reusable audio cached by content hash; personalised dialogue streamed. |
| P2-05 | Backend | Streaming ASR: partial transcripts, voice activity, end-of-turn detection (bar: ≥98% on the voice test set). |
| P2-06 | Frontend | Barge-in: interruption stops Aria's speech in <250ms p95. |
| P2-07 | Frontend | Microphone permission, device selection, parent-friendly sound check, captions, mute, device recovery, text/tap fallback. |
| P2-08 | Frontend | Autoplay reality: visible welcome immediately, speech when the browser permits, unlocked by the child's natural class selection — **never** "press Aria's face". |
| P2-09 | Backend | Oral-reading timing events captured, ahead of the full reading curriculum. |
| P2-10 | QA | Phase 2 exit: a five-year-old who cannot read completes a full session alone. |

## Phase 3 — Durable relationship memory and engagement

| Id | Track | Scope |
|---|---|---|
| P3-01 | Backend | `learner_episode`, `learner_brief`, correction history. |
| P3-02 | Backend | Consolidation expanded; expiry and conflict resolution; periodic rebuild from raw events so summary drift is detectable. |
| P3-03 | Backend | The learner brief: generated from current evidence, **never** recursively summarised from the previous paragraph. Versioned by week, month and school year. |
| P3-04 | Backend | The full skill graph and scheduler: spaced repetition, prerequisites, misconceptions. |
| P3-05 | Backend | Temporary, confidence-scored engagement state with check-ins — low confidence causes a question, never a declaration. No camera-based emotion recognition, ever. |
| P3-06 | QA | Phase 3 exit: the tutor opens knowing the child without inventing facts. |

## Phase 4 — Reading and writing to the real bar

| Id | Track | Scope |
|---|---|---|
| P4-01 | Backend | The phonics ladder as skills and the taught-pattern list per child. |
| P4-02 | Backend | The decodable-text filter: a deterministic gate rejecting any passage with a word outside this child's taught patterns. A model will break this rule constantly unless code enforces it. |
| P4-03 | Backend | Oral reading assessment: WCPM, missed words, and the phonics patterns those words share, feeding skill state. |
| P4-04 | Backend + Frontend | The writing coach loop: draft → **one** note → revision → acknowledgement. `child_writing` retained until the parent deletes it. |
| P4-05 | QA | Phase 4 exit: a non-reader reaches decoding CVC text inside the product, and we can show the parent the week it happened. |

## Phase 5 — The Primer

| Id | Track | Scope |
|---|---|---|
| P5-01 | Backend | `narrative_thread`: a continuing story built from this child's current interests that carries the lessons rather than framing them. |
| P5-02 | Backend | The child's life appears only through consented, current relationship facts. |
| P5-03 | QA | Phase 5 exit: the child asks to use it. |

## Phase 6 — Parent and teacher agents

| Id | Track | Scope |
|---|---|---|
| P6-01 | Backend | Weekly digest: five plain sentences, no charts. |
| P6-02 | Backend | Ask-Aria for parents, grounded in the actual event log. |
| P6-03 | Backend | Parent goals folded into the plan. |
| P6-04 | Frontend | Full transcripts, learner memory view, and the correction path. |
| P6-05 | Backend | Teacher class report, ask, directive and unprompted alerts with explicit notification rules. |
| P6-06 | QA | Phase 6 exit: a parent renews without being asked. |

## Phase 7 — Scale

| Id | Track | Scope |
|---|---|---|
| P7-01 | Backend | Expand and share verified non-personalised content across children. |
| P7-02 | Backend | Optimise the cache and pre-generation built in Phase 0. |
| P7-03 | Backend | Tier routing tuned: cheap model for hints and grading, strong model for teaching and gating — every move backed by a golden-set run. |
| P7-04 | Ops | Cost per child per month measured and driven down. |
| P7-05 | QA | Phase 7 exit: unit economics work at a consumer price without weakening any quality bar. |

---

## Deliberately not built (`master-plan.md` §14)

No ticket in this backlog may quietly reintroduce: a menu, mastery percentages shown to the
child, leaderboards, a punishing streak, video lessons, a district sales motion, replacing
teachers, or grades.
