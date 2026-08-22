# The Rewrite — one UI carries forward, everything else starts fresh

Companion to [`master-plan.md`](master-plan.md) (the product) and
[`cloud-model-layer.md`](cloud-model-layer.md) (the model layer). Those two say *what*
Aria must become. This one says what we start from, now that the first version is frozen.

---

## 1. The decision

The first version — Java 21 / Spring Boot backend, Vite frontend, Electron shell with a
bundled JRE, PostgreSQL and Ollama — lives under `legacy/` and is never edited, built, run
or imported from. The new product is:

| Layer | Stack |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Node + Express + TypeScript |
| Database | PostgreSQL |
| Models | Hosted only. No Ollama, no local weights, no offline mode. |

This is a rewrite, not a port. The authority order is:

1. The required tutor behaviour in [`master-plan.md`](master-plan.md).
2. The stack and delivery decisions in this document and
   [`cloud-model-layer.md`](cloud-model-layer.md).
3. The existing student session UI as a changeable design starting point.
4. Everything else under `legacy/`, which is historical evidence and optional inspiration.

Legacy code never wins a disagreement with the new product requirements.

---

## 2. The one thing that carries forward: the student session UI

`legacy/frontend/src/session/` is already React + TypeScript. It is the only implementation
that carries forward, because its age-band design, simplicity and class-first entry were
created deliberately for the new child experience. Bring it into the new frontend as the
visual and experiential starting point.

"Carries forward" does **not** mean frozen. We do not redraw it without reason, but its
components, controls, layout, state machine and API contract may change whenever the tutor
behaviour in `master-plan.md` requires it.

### What it is — four screens

| Screen | File | What it does |
|---|---|---|
| Class picker | `SubjectPicker.tsx` | The child's front door. The one choice they make. |
| Session — early (TK–2) | `layouts/EarlyLayout.tsx` | Owl, speech bubble, huge tap tiles, star jar. Almost no text. |
| Session — middle (3–5) | `layouts/MiddleLayout.tsx` | Text and picture together, progress dots, Ask Aria. |
| Session — senior (6–8) | `layouts/SeniorLayout.tsx` | Quiet and adult. No owl. Segmented bar, work pad. |

`SessionPage.tsx` picks the layout from `bandForGrade()` in `band.ts`. Around them sit
fifteen components (`components/`), `session.css`, and the shared vocabulary in
`types.ts`, `subjects.ts` and `text.ts`.

### What survives and what does not

Preserve by default:

- The class picker as the child's one meaningful choice.
- The distinct early, middle and senior visual languages.
- One focused stage rather than a child-facing dashboard or topic menu.
- Large, accessible controls and the existing design tokens where they still work.
- Aria's visual presence for younger children and the quieter senior treatment.

Replace or change as required:

- The old `start/answer/hint/next/ask` `SessionSource` contract. It is shaped like a quiz and
  cannot express arrival, proactive moves, streaming speech, silence or interruption.
- The fixed `SessionStep`/`StepResult` state machine and hard-coded two-attempt policy.
- Browser speech as the primary voice system.
- The separate "Ask Aria" interaction if the live conversation makes it redundant.
- Any component that cannot render the new event/move protocol or multimodal content.

### How to bring it forward

Move the UI into `apps/web` in a reviewable commit so its visual baseline can be compared in
all three bands. Then replace the behaviour beneath it before connecting a real backend:

1. Keep a screenshot or visual test of the existing class picker and three layouts.
2. Define new shared `TutorInputEvent` and `TutorMove` unions from `master-plan.md` §4.1.
3. Drive arrival, welcome, recommendation, conversation, listening, interruption and ending
   through a new scripted tutor source.
4. Refactor or replace components until every required move renders accessibly in each band.
5. Connect the same protocol to the real backend in Phase 1 and live voice in Phase 2.

The old mock content can inspire the new scripted scenarios, but it is not copied as the new
contract. The regex reply system, old API session source and old voice plumbing do not carry
forward.

---

## 3. How legacy material may be used

Nothing else is reimplemented by translation. Engineers may inspect legacy material when it
answers a specific question or supplies a real defect case. They then design the new module
from the current requirements.

| Legacy source | Permitted use |
|---|---|
| `QuestionSanitizer.java` | Seed regression cases for structural failures found previously. |
| `AnswerMatcher.java` | Seed comparison edge cases for new tests. |
| `MathAnswerChecker.java` | Seed accepted and deliberately refused arithmetic examples. |
| `db/migration/V1..V24` | Historical evidence when designing new tables; never a schema to continue. |
| `resources/curriculum/*.json` | Reference during authoring and review of the new skill graph; never assumed correct or moved automatically. |

Auth, enrolment, memory, curriculum, quality gates, generation, prompts, voice, progress,
reporting and the runtime are all built fresh. Copying a legacy module requires a new owner
decision recorded in these documents; there are no implied exceptions.

---

## 4. Repo layout — proposed, not yet built

```
apps/
  web/        React + TypeScript + Vite. The carried-forward session UI starts here.
  api/        Node + Express + TypeScript.
packages/
  shared/     TutorInputEvent, TutorMove, Band and other shared protocol types.
dev-docs/     These plans.
legacy/       Frozen. Reference only.
```

npm workspaces. `packages/shared` holds the new protocol defined from `master-plan.md`; no
legacy UI type becomes an API contract merely because it already exists.

Migrations run from `apps/api`, numbered from `001`. PostgreSQL only — the old plan's
partial unique indexes and `TIMESTAMPTZ` assumptions still hold.

---

## 5. Order of work

1. **Scaffold** the workspace, TypeScript config, lint and `.env.example`.
2. **Bring the session UI forward** and capture its visual baseline in all three bands.
3. **Define the new shared event/move protocol** and run the UI against scripted arrival,
   tutoring, voice-state and interruption scenarios. Change components as required.
4. **Build the model layer and both golden sets** — content plus multi-turn tutoring — with
   retry, fallback, cost accounting, streaming capability and a small verified cache.
5. **Build Phase 1 of `master-plan.md`**: proactive text-first arrival, minimal supported
   memory and skill state, and the real tutor loop.
6. Continue through real-time voice, durable relationship memory, teaching and scale in the
   phase order of `master-plan.md` §13.

Only the visual starting point in step 2 is carried-forward product work. Every behavioural
contract from step 3 onward is new product.

---

## 6. Open questions this rewrite reopens

| Question | Why it matters now |
|---|---|
| Does the desktop app survive? | Cloud-only removed the offline-with-no-account argument. A web app may be the right shape. Nothing in `legacy/desktop/` is being ported until this is answered. |
| Auth: build it ourselves or use a hosted identity provider? | Identity is required but not our differentiator; choose from current security and child-account requirements, not the old implementation. |
| Does the authored curriculum live in versioned files, the database, or both? | `master-plan.md` §4.4 requires a reviewable skill graph and runtime queries; storage must support both without making legacy JSON authoritative. |
