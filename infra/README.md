# Running Aria

Everything about deploying this repository: the topology, the three environments, who may
deploy, and what to do when something breaks at an unhelpful hour.

Decisions live in [`decisions/`](decisions/). Read [001](decisions/001-hosting.md) first — it
explains why any of the rest is shaped the way it is.

> **What is real today.** The Dockerfiles build, the migration CLI and its flags work, the
> secret scan and the environment-template check run in CI, and the smoke gate has been run
> against a live container. The Fly apps, the Supabase projects and the GitHub secrets the
> workflows reference **do not exist yet** — creating them needs the repo owner's accounts.
> "Bringing an environment up" below is the list of what that takes.

## Topology

```
                    ┌──────────────┐
   a family ───────▶│  aria-web-*  │  nginx, static bundle, /healthz
                    └──────┬───────┘
                           │  VITE_API_BASE_URL, baked at build time
                           ▼
                    ┌──────────────┐        ┌────────────────────┐
                    │  aria-api-*  │───────▶│ Supabase Postgres  │
                    │  Express     │        │ (also adult auth)  │
                    │ /api/v1/health        └────────────────────┘
                    └──────┬───────┘
                           │                ┌────────────────────┐
                           ├───────────────▶│ Anthropic / OpenAI │
                           │                │ / Groq             │
                           │                └────────────────────┘
                           ▼
                 ┌───────────────────┐      ┌────────────────────┐
                 │ aria-voice-worker │─────▶│  LiveKit Cloud     │
                 │ (arrives with #18)│      └────────────────────┘
                 └───────────────────┘
```

## Environments

| | `dev` | `staging` | `prod` |
|---|---|---|---|
| Deploys | manually | every push to `main` | manual dispatch, by tag |
| Approval | none | none | GitHub environment reviewer |
| Data | throwaway | throwaway, no production keys | real children |
| `ARIA_DEMO_STUDENT_ID` | allowed | forbidden by convention | refused by the API **and** by the deploy |
| Size | 1 machine each | 1–2 machines | 2+ API machines, never scaled to zero |

Staging is shaped exactly like production apart from size. That is the point of it: a release
is proved there, and so is the rollback.

## Who can deploy

- **Staging** — anything that merges to `main`. No human step.
- **Production** — a repo owner, by running the *Deploy production* workflow with a tag. The
  gate is a GitHub environment with required reviewers, not a branch rule, so the approval is
  recorded against the deploy rather than against the merge.
- Nobody deploys from a laptop. `flyctl deploy` from a developer machine bypasses migrations,
  the guards and the smoke gate. If it is ever necessary, it is an incident and it goes in the
  log below.

## Bringing an environment up

Once, per environment, by someone with the accounts:

1. **Supabase project** — one per environment. Copy the pooled connection string; that is
   `DATABASE_URL`. The identity keys P0-28 needs come from the same project.
2. **Fly apps** — `flyctl apps create aria-api-staging`, likewise `aria-web-staging` and
   (when it exists) `aria-voice-worker-staging`.
3. **Secrets** — every name in `environments/staging.env.example`, set with
   `flyctl secrets set --app aria-api-staging KEY=value`. Never a value in a file, ever.
4. **GitHub** — repository secrets `FLY_API_TOKEN`, `STAGING_DATABASE_URL`,
   `PROD_DATABASE_URL`; environments `staging` and `production`, the latter with reviewers.
5. **First migration** — `npm run db:migrate -w @aria/api -- --url "$DATABASE_URL" --dry-run`,
   read what it plans, then run it without the flag.
6. **Smoke** — `npm run smoke -- --api https://… --web https://…`.

## Migrations: expand, migrate, contract

The rule that makes a rollback safe:

> A migration must leave the **previous** release working.

So a schema change that would break the running code is split across two releases:

1. **Expand.** Add the new column, nullable, alongside the old one. Deploy. Both releases work.
2. **Migrate.** Backfill, and switch the code to the new column. Deploy.
3. **Contract.** Drop the old column, in a later release, once no rollback target still reads
   it.

Because of this, **rolling back code never requires rolling back schema** — which is what lets
the rollback below be one command instead of a restore.

The runner enforces the rest by itself: one transaction per file, a ledger row written inside
that transaction, a checksum so a merged migration can never be edited, and a refusal to apply
a migration numbered behind one already applied. That last rule has an escape hatch,
`--allow-gap`, for two branches that both merged; it is an operator decision and is logged as
one.

## Rollback

Code, and only code:

```bash
flyctl deploy --app aria-api-prod --image <previous-image-reference> --strategy immediate
```

The previous reference is printed in the deploy job's summary before anything is replaced.
Staging rolls itself back automatically on a failed deploy; production does not, because the
right answer there is sometimes to roll forward and a workflow cannot tell which.

**Target: under five minutes.** Exercised on staging with every release — the staging workflow
records the previous image on every run, which is what makes the drill one command rather than
an investigation.

## When something breaks

**The API will not start.** Boot refuses loudly and by name: a missing variable, a database it
cannot reach, an authored curriculum defect, a routed model endpoint with no key. Read
`flyctl logs --app aria-api-prod`; the first fatal line names the thing. An instance that fails
its health check never receives traffic, so the previous release is still serving.

**A migration failed halfway.** It didn't. One file is one transaction, so a failed file
leaves nothing behind and no ledger row — the deploy aborts before any code ships. Fix the
migration, push, deploy again.

**LiveKit region outage.** Voice is down; tutoring is not. `/api/v1/health` reports voice as
degraded and the web app offers the text and tap path (P2-07). Say so on the status page; do
not fail the API's health check over it.

**The voice worker must restart during live sessions.** It drains: stops accepting rooms,
finishes what it holds, up to the platform's five-minute ceiling. A senior-band session is
longer than that ceiling, so deploy the worker outside peak hours; P2-13's outbox resume covers
the sessions a forced restart does interrupt.

**A key leaked.** Rotate at the vendor first, then `flyctl secrets set` the new value — the old
one stays valid until the new instances pass their health checks. Then find how it got in:
`npm run scan:secrets` runs over every tracked file and is part of `npm run check`.

**Restore from backup.** Supabase takes nightly snapshots. Restoring is a Supabase console
operation into a *new* database, then repointing `DATABASE_URL`. Tested quarterly on staging,
and each test logged below.

## Log

Rollback drills, restore tests and any deploy that bypassed this document.

| Date | What | Who | Notes |
|---|---|---|---|
| — | — | — | Nothing yet: no environment exists. |
