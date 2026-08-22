# Legacy tree — frozen, not built, not run

Everything under `legacy/` is the first version of Aria Learn. It is kept for
reference only. Do not add features here, do not fix bugs here, and do not wire
the new app to anything in here.

## What it was

| Part | Stack |
|---|---|
| `backend/` | Java 21, Spring Boot 3.4.1, Flyway (through `V24`), PostgreSQL |
| `frontend/` | React + Vite + TypeScript |
| `desktop/` | Electron shell bundling a JRE, PostgreSQL and Ollama |
| `e2e-agent/` | Browser-driven exploratory test agent |
| `docs/` | Desktop architecture, Apple signing, distribution |
| `scripts/` | Release signing helper |
| `.github/workflows/` | The desktop release workflow, moved here so it stops running |

## Why it is frozen

The rewrite changes both the runtime and the product shape:

- Backend moves from Java/Spring to Node + Express.
- The model layer becomes cloud-only. See `dev-docs/cloud-model-layer.md`.
- The product becomes an agentic tutor, not twelve stateless generators.
  See `dev-docs/master-plan.md`.

## The one part that is copied, not just read

`frontend/src/session/` is the student session UI — the class picker and the three age-band
layouts. It is already React + TypeScript, so it is copied into the new frontend rather than
rewritten. `dev-docs/rewrite.md` §2 says exactly what to change on the way in, and what to
leave behind. Copying is a one-time move at scaffold time. Nothing in the new tree ever
imports from this folder.

## What is still worth reading

- `backend/src/main/java/com/mathtutor/ai/QuestionSanitizer.java` — every
  defect a generated question can carry, and the repair for each one.
- `backend/src/main/java/com/mathtutor/ai/AnswerMatcher.java` — why a stored
  answer key can never be compared by plain string equality.
- `backend/src/main/java/com/mathtutor/ai/MathAnswerChecker.java` — the
  deterministic checks that run before any model call, and the two question
  families it deliberately refuses.
- `backend/src/main/resources/db/migration/` — the data model that worked.
- `backend/src/main/resources/curriculum/` — the curriculum JSON.
- `CLAUDE.md` — the full gotcha list for the old stack.

Port the reasoning. Do not port the code.
