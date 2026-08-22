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

## Running it

Nothing to run yet. This section gets written with the first commit that has
something to start.
