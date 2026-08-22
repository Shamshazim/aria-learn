# The Rewrite — what carries forward, what gets rebuilt

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

This is a rewrite, not a port. Nothing in `legacy/` is a starting point except the one
thing named in section 2.

---

## 2. The one thing that carries forward: the student session UI

`legacy/frontend/src/session/` is already React + TypeScript. It is the only part of the
old tree on the target stack, it is the part that took the most design work, and it is
the part the product argument in `master-plan.md` §5 is built on. **We copy it into the
new frontend and keep going from there.** We do not redraw it.

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

### Why it survives the rewrite intact

The UI was written against an interface, not against the Java backend:

```ts
export interface SessionSource {
  start(): Promise<SessionState>
  answer(stepId: string, response: string): Promise<StepResult>
  hint(stepId: string): Promise<{ hint: string | null; teach: string | null }>
  next(): Promise<SessionState | null>
  ask(text: string): Promise<string>
}
```

No component knows what is behind it. Two implementations already exist:
`sources/apiSession.ts` (the old backend) and `sources/mockSession.ts` (a scripted session,
so the three layouts can be reviewed with no backend at all).

That seam is worth more than the pixels. `master-plan.md` §10 replaces seven per-question
endpoints with one `POST /student/session/turn`. That change lands entirely inside a new
`SessionSource` implementation — **no layout and no component changes.** It also means the
new frontend runs against `mockSession.ts` from day one, before the Node API exists.

### What to copy, and what to fix while copying

Copy `legacy/frontend/src/session/` wholesale. It touches the outside world in exactly
four places, and each is a small, deliberate rewrite:

| File | Reaches out to | Do this |
|---|---|---|
| `SubjectPicker.tsx` | `../api`, `../auth` | Repoint at the new API client and auth. |
| `SessionPage.tsx` | `../auth` | Same. |
| `sources/apiSession.ts` | `../../api`, `../../lib/steps` | **Do not port.** Write a new source against `POST /session/turn`. |
| `useSpeech.ts` | `../../lib/voice` | Browser speech synthesis stub. Keep until Phase 3 replaces it. |

`sources/mockSession.ts` and `sources/mockContent.ts` copy with no change and should be
the first thing running in the new tree.

`sources/replies.ts` is the `localReply()` regex that fakes Aria talking in the browser.
**Delete it on the way in.** `master-plan.md` gap 2 exists because of this file; copying
it forward would carry the exact defect the rewrite is meant to end.

---

## 3. What gets reimplemented from reasoning, not copied

These are Java and do not port. Read them, take the reasoning, write TypeScript.
`legacy/LEGACY.md` says where they are.

| Legacy source | What to take from it |
|---|---|
| `QuestionSanitizer.java` | The catalogue of defects a generated question can carry, and the repair or rejection for each. Every one of them was found in production output. |
| `AnswerMatcher.java` | Why a stored answer key can never be compared with `==`. |
| `MathAnswerChecker.java` | The deterministic checks that must run *before* any model call, and the two question families it deliberately refuses. |
| `db/migration/V1..V24` | The data model that worked. New migrations start at `001`, not `V25`. |
| `resources/curriculum/*.json` | The curriculum content. Data, so it moves as-is. |

Everything else — auth, enrolment, progress, gamification, generation, prompts, the
Electron shell — is rebuilt to the plan in `master-plan.md`, not translated.

---

## 4. Repo layout — proposed, not yet built

```
apps/
  web/        React + TypeScript + Vite. src/session/ arrives here first.
  api/        Node + Express + TypeScript.
packages/
  shared/     Types both sides need: SessionStep, StepResult, Band, curriculum shapes.
dev-docs/     These plans.
legacy/       Frozen. Reference only.
```

npm workspaces. `packages/shared` matters more here than it looks: `types.ts` in the
session UI *is* the API contract, and it should live in one place that both apps import.

Migrations run from `apps/api`, numbered from `001`. PostgreSQL only — the old plan's
partial unique indexes and `TIMESTAMPTZ` assumptions still hold.

---

## 5. Order of work

1. **Scaffold** the workspace, TypeScript config, lint, and `.env.example`.
2. **Copy the session UI** into `apps/web`, running against `mockSession.ts`. The four
   screens must render in all three bands before any backend exists. This is the fastest
   proof the rewrite has not lost anything.
3. **The model layer** — [`cloud-model-layer.md`](cloud-model-layer.md), built fresh in
   TypeScript. Provider registry, tier routing, retry and fallback, cost accounting.
4. **The golden set** and the harness. Nothing downstream is trustworthy without a number.
5. **The tutor loop** — `session` and `session_event` tables, `POST /session/turn`, and a
   real `SessionSource` in the web app. This is where the copied UI stops being a mock.
6. Then `master-plan.md` §13, Phase 2 onward: memory, voice, reading and writing.

Steps 1 and 2 are the whole scope of "get back to where we were, on the new stack".
Everything from step 3 is new product.

---

## 6. Open questions this rewrite reopens

| Question | Why it matters now |
|---|---|
| Does the desktop app survive? | Cloud-only removed the offline-with-no-account argument. A web app may be the right shape. Nothing in `legacy/desktop/` is being ported until this is answered. |
| Auth: rebuild JWT as-is, or use a hosted identity provider? | The old one worked. It is also not our product. |
| Does the curriculum stay JSON in the repo, or move into the database? | `master-plan.md` §4.3 wants a skill graph, which is a database shape, not a file shape. |
