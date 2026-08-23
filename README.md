# Aria Learn

An AI tutor for children, TK through grade 8.

## Status

The product is being rebuilt around the existing student session UI, which carries forward
as a changeable visual starting point. Everything else is built fresh. The first version is
frozen under [`legacy/`](legacy/LEGACY.md) and is no longer built or run.

## Target stack

| Part | Stack |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Node + Express + TypeScript |
| Database | PostgreSQL |
| Models | Hosted only. No local models. |

## Plans

- [`dev-docs/rewrite.md`](dev-docs/rewrite.md) — the rewrite: what carries
  forward from the first version, what gets rebuilt, and in what order. Start
  here.
- [`dev-docs/master-plan.md`](dev-docs/master-plan.md) — the product: what an
  agentic tutor has to do that a question generator does not.
- [`dev-docs/cloud-model-layer.md`](dev-docs/cloud-model-layer.md) — the model
  layer: cloud-only, pluggable by config, with cost, failure and privacy
  handled as first-class concerns.
- [`dev-docs/tickets/`](dev-docs/tickets/README.md) — the plans turned into work:
  self-contained tickets for Phase 0 and Phase 1, the code standards every
  ticket is bound by, and the backlog for later phases.

## The workspace

npm workspaces, TypeScript everywhere, one command that checks the whole repo.

```
apps/
  api/        Node + Express + TypeScript          @aria/api
              routes → controllers → services → repositories, and raw SQL under db/
  web/        React + TypeScript + Vite            @aria/web
packages/
  shared/     Tutor protocol types and schemas     @aria/shared
dev-docs/     The plans and the tickets
legacy/       The frozen first version. Reference only — never built, run or imported.
```

Imports use path aliases, never a relative path that leaves its own package: `@aria/shared`
for the protocol, and `@/*` for a file inside the same app.

## Running it

Requires **Node 22 or newer** (`.nvmrc` pins the version; run `nvm use`).

```bash
npm ci          # install every workspace
cp .env.example .env
npm run check   # typecheck + lint + test — the same gate CI runs
```

### The database

PostgreSQL 16, and it is not optional: the API refuses to start without a reachable
`DATABASE_URL`, rather than discovering it on a request. Create the role and database once —

```bash
createuser --createdb --pwprompt aria      # password: aria, to match .env.example
createdb -O aria aria_dev
npm run db:migrate -w @aria/api            # applies migrations; a no-op the second time
```

The database tests create and drop a throwaway database per test file, which is why the role
needs `CREATEDB`. They skip themselves when `DATABASE_URL` is unset — but never on CI, where
an unset variable is a misconfiguration and skipping would turn them into no-ops.

Migrations are raw SQL in `apps/api/src/db/migrations`, numbered `NNN_snake_case.sql`, and
**forward-only**: once merged a migration is never edited. The runner checksums each one and
refuses to start if a file it already applied has changed, or if a migration turns up numbered
behind one that has already run.

| Script | What it does |
|---|---|
| `npm run dev` | Starts each app that has a dev server |
| `npm run build` | Builds each app that has a build |
| `npm run typecheck` | `tsc --noEmit` across the root config and every workspace |
| `npm run lint` / `lint:fix` | ESLint over `apps/`, `packages/` and the root configs |
| `npm run format` / `format:fix` | Prettier check / write |
| `npm test` / `test:watch` | Vitest across the `shared`, `api` and `web` projects |
| `npm run check` | typecheck, then lint, then test |
| `npm run db:migrate -w @aria/api` | Applies pending migrations. Idempotent. |

The API shell, the shared tutor protocol and the database foundation are in place (P0-02 to
P0-04). The web app is next (P0-05); there are no product endpoints yet — Phase 1 adds them.

### The rules are enforced, not remembered

[`CODE-STANDARDS.md`](dev-docs/tickets/CODE-STANDARDS.md) is binding, and the parts a person
would otherwise have to police are wired into the toolchain. Lint fails the build on a file
over 300 lines, on `any`, on a circular import, on a relative import that escapes its
package, and on any import from `legacy/`.
