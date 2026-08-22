# Code Standards — read before writing a single line

This file is binding on every ticket in `dev-docs/tickets/`. If a ticket and this file
disagree, this file wins unless the ticket says "overrides CODE-STANDARDS §n" and gives a
reason.

The goal is one thing: **a production-ready, clean, DRY, modular TypeScript codebase that a
new engineer can extend without reading the whole tree.** Everything below serves that.

---

## 1. TypeScript, everywhere, strict

- TypeScript only. No `.js` source files, no JSX without types, no untyped config scripts.
- `strict: true`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`.
- **`any` is banned in committed code.** Use `unknown` and narrow. If a vendor SDK forces it,
  isolate it in one adapter file with a `// eslint-disable-next-line` and a one-line comment
  saying why.
- No non-null assertion (`!`) to silence the compiler. Narrow, or make the type honest.
- No type assertions (`as X`) across a trust boundary. Data entering the process — HTTP body,
  query result, model response, config file, `process.env` — is parsed and validated with a
  schema (zod), never asserted.
- Prefer `type` for shapes and unions; use `interface` only when declaration merging or an
  implements-style port is genuinely wanted.
- Discriminated unions over boolean flags. `TutorMove` is a union on `kind`, not an object
  with twelve optional fields.
- Exported functions get explicit return types. Inference is fine inside a function body.

## 2. File size — the 300-line rule

**No source file exceeds 300 lines.** This is checked in CI, not by good intentions.

When a file approaches 300 lines it is **split by responsibility, never sliced at line 300**:

- A controller with six handlers becomes six handler files plus one small router.
- A service doing "retrieve, decide, persist" becomes three collaborators and a thin
  orchestrator.
- A React component over 300 lines is at least two components, or a component plus a hook.
- Long constant tables, fixtures and seed data move to their own `*.data.ts` / `__fixtures__`
  file; data is not logic and should not sit inside a module that has behaviour.

Targets, not just the ceiling: most files land at 80–150 lines. A file at 290 lines is a
smell, not a success.

Functions: keep under ~40 lines and one level of abstraction. If a function needs a section
comment ("// now build the prompt"), that section is a function.

## 3. Separation of concerns — the rule that matters most

**One file, one concern.** Types do not live with controllers. Routers do not live with
handlers. Validation schemas do not live with business logic. SQL does not live in a service.

### 3.1 Backend layering (Node + Express + TypeScript)

Dependencies point **downward only**. A layer may import from the layer below it and from
`types`/`errors`/`shared`. It may never import from the layer above.

```
routes/         Express Router wiring only. Path -> middleware -> controller. No logic.
middleware/     Cross-cutting: auth, request id, validation, error handler, rate limit.
controllers/    HTTP in, HTTP out. Parse+validate the request, call one service, map the
                result to a status code and a response DTO. No business rules. No SQL.
services/       All business logic. Pure-ish, framework-free. Knows nothing about Express:
                no req, no res, no status codes, no headers.
repositories/   All database access. One repository per aggregate. Returns domain objects,
                never raw driver rows. The only place SQL exists.
db/             Pool, transaction helper, migration runner, migrations/.
schemas/        zod schemas for request/response validation. One file per resource.
types/          Domain types and DTOs. Declarations only — no runtime behaviour.
mappers/        row -> domain, domain -> DTO. Explicit, tested, no implicit spreads.
errors/         The AppError hierarchy and error codes.
config/         Parsed, validated configuration. Read once at boot.
ai/             The model layer (its own internal layering — see the Phase 0 tickets).
```

A request flows: `router → middleware → controller → service → repository → db`, and back.
Nothing skips a layer. A controller never calls a repository. A service never touches `res`.

**Express specifics**
- Handlers are `async` and wrapped by one `asyncHandler` so rejections reach the error
  middleware. No `try/catch` boilerplate in every controller.
- Exactly one error-handling middleware, registered last. It maps `AppError` to a status
  code and a stable `{ error: { code, message, requestId } }` body. It never leaks a stack
  trace, a SQL string, a vendor name or a key to the client.
- Validation happens in middleware from a zod schema, before the controller runs. The
  controller receives typed, validated input.
- Routers are composed: `app.use('/api/v1/student', studentRouter)`. One router file per
  resource, and it does nothing but wire.
- Services are created by **factory functions with explicit dependencies**
  (`createSessionService({ sessionRepo, aiClient, clock })`), not by importing singletons.
  This is what makes them testable and what keeps the app from growing a hidden global graph.
- No business logic in `app.ts`. It composes middleware and routers and exports the app;
  `server.ts` listens. That split is what makes supertest tests possible.

### 3.2 Frontend layering (React + TypeScript + Vite)

```
src/
  app/            App shell, providers, router. Composition only.
  pages/          One file per route. Composes features. No fetch calls, no business rules.
  features/<x>/   A vertical slice: components/, hooks/, model/ (state + logic), api/.
  components/     Shared, presentational, app-agnostic UI. No data fetching. No feature
                  imports.
  hooks/          Shared hooks.
  api/            The HTTP client, endpoint modules, and response parsing. The only place
                  fetch/axios appears.
  lib/            Framework-free helpers. Pure functions, unit tested.
  types/          Shared UI types. Protocol types come from packages/shared.
  styles/         Tokens and global CSS.
```

- **UI logic and business logic never share a file.** A component renders props and raises
  events. Decisions, sequencing, retries, derived state and protocol handling live in a hook
  or a plain module under `features/<x>/model/`, which is testable without rendering.
- Components do not call `fetch`. They call a hook; the hook calls `api/`.
- Prop drilling more than two levels means a context or a store, not a third level.
- Every component file exports **one** component. Small private subcomponents in the same
  file are allowed only if the file stays well under 300 lines and they are not reused.
- Keys, effects and state: no `useEffect` for data that can be derived; no state that
  duplicates a prop; every effect has a stated reason and a cleanup where relevant.
- Accessibility is a requirement, not a polish ticket: semantic elements, labels, visible
  focus, keyboard operability, `prefers-reduced-motion` respected. Our users are children,
  and the youngest cannot read.

### 3.3 Shared code

`packages/shared` holds only what both sides genuinely need: the tutor event/move protocol,
band types, and their zod schemas. It has **no runtime dependencies on either app**, no
React, no Express, no database driver. If only one side needs it, it does not belong there.

## 4. Modularity, DRY and scale

- **A module has one public entry.** Export the intended surface from `index.ts`; everything
  else in the folder is internal. A barrel that re-exports is fine; a barrel with logic is not.
- No circular imports. CI fails on them.
- DRY means one source of truth for a **rule**, not deduplicating coincidentally similar code.
  Two things that look alike but change for different reasons stay separate.
- Extend by adding a file, not by editing a switch: registries and maps
  (`Record<MoveKind, Renderer>`, `Record<Api, AdapterFactory>`) over growing conditionals.
- Everything that varies by environment or vendor is **configuration**, validated at boot.
  Adding a model vendor must not require touching business logic.
- Services are stateless. Any state lives in PostgreSQL or an explicit cache with an owner.
  No module-level mutable singletons. That is what lets us run more than one instance.
- Clock, randomness, IDs and network are injected, never called inline in a service. This is
  a hard rule: it is the difference between a testable system and a flaky one.

## 5. Errors, logging, safety

- One `AppError` base with a stable machine-readable `code`, an HTTP status and a
  `safeMessage`. Domain errors extend it. Unknown errors become a 500 with a generic body.
- Never swallow an error. Either handle it or let it propagate to the error middleware.
- Structured JSON logging with a request/session correlation id. Levels used honestly.
- **Never log:** an API key, a full prompt body, a child's name, a parent email, an auth
  token, or anything else identifying. Log ids and categories instead.
- Child-facing messages never contain a vendor name, model name, status code or stack trace.

## 6. Testing

- Vitest for unit and integration; Playwright for browser end-to-end.
- Every service and every pure module has unit tests. Every endpoint has a supertest
  integration test covering success, validation failure and the auth/permission failure.
- Deterministic checkers (arithmetic, structural, decodability) are **table-driven** with the
  fixture table in its own data file.
- The model is never called in a unit test. Ports are faked at the port, not with a network
  mock.
- A bug fix ships with the failing test that proves it.

## 7. Style, naming, hygiene

- ESLint + Prettier, enforced in CI. No committed lint errors, no committed warnings we have
  agreed to ignore.
- `camelCase` values, `PascalCase` types and components, `SCREAMING_SNAKE` module constants,
  `kebab-case` filenames for modules, `PascalCase.tsx` for components.
- Names say what a thing is, not how it was made. `resolveNextMove`, not `handleData2`.
- Comments explain **why**. The code already says what. No commented-out code, no `TODO`
  without a ticket id.
- No dead code, no unused exports, no "we might need this later".
- Absolute imports via path aliases (`@/services/...`, `@aria/shared`). No `../../../`.

## 8. Security and privacy, in code

- No secret in the repository, ever. `.env` is gitignored; `.env.example` lists every key
  with a dummy value.
- Validate and bound every input: body size, string length, array length, numeric range.
- Parameterised SQL only. String-concatenated SQL is a review rejection.
- The rules in `master-plan.md` §12 and `cloud-model-layer.md` §11 are code requirements:
  identifying data never crosses the model-vendor boundary, and every child-facing output
  passes the safety gate with no fast path.

## 9. Definition of done (every ticket)

1. Acceptance criteria in the ticket all met.
2. `npm run typecheck`, `npm run lint`, `npm test` pass at the repo root.
3. No file over 300 lines; no new `any`; no new circular import.
4. Tests written at the level the ticket names.
5. Public modules documented by their types, plus a short module-header comment where the
   purpose is not obvious from the name.
6. No file under `legacy/` edited, imported or executed.
7. Branch pushed and a PR opened. Never a direct push to `main`.
