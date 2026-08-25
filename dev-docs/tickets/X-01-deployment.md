# X-01 — Deployment: environments, CI, migrations, secrets, rollout

| | |
|---|---|
| **Phase** | Cross-cutting (needed before any real child uses Phase 2H) |
| **Track** | Infra |
| **Depends on** | P0-24 |
| **Blocks** | P2H-13, P2H-14, X-02, X-04, P6-09 |
| **Parallel-safe with** | every Backend/Frontend ticket |
| **Size** | L |

## Why

Nothing runs outside a developer laptop. `master-plan.md` §4.6: "network failure is now
normal", and §12.1: we say plainly that Aria uses a cloud model — which presumes there is a
cloud deployment to say it about. CI already runs typecheck/lint/test/e2e on every PR
(`.github/workflows/ci.yml`); there is no Dockerfile, no environment, no way to run a
migration against a real database, and no way to roll back. The LiveKit worker, the API,
the web app and Postgres each need a home, and the vendor keys need one that is not `.env`.

## Scope

### Build
Three environments (dev, staging, prod), container images for `apps/api` and
`apps/voice-worker`, a static build for `apps/web`, managed Postgres, LiveKit (Cloud or
self-hosted — a recorded decision), a secrets manager, migrations run as a deploy step,
health-gated rollout, one-command rollback, and the runbook.

### Do not build
No Kubernetes unless the decision record says why a PaaS cannot host the voice worker. No
multi-region (explicitly deferred, `BACKLOG.md` Phase 2). No desktop packaging — the
`cloud-model-layer.md` §14 desktop question is answered here as **web app only** unless
Product overrides it in the PR.

## Design

```
infra/
  README.md                   the topology, the environments, who can deploy, the runbook
  decisions/
    001-hosting.md            PaaS vs containers-on-VMs vs k8s, with the voice worker's
                              needs (long-lived process, outbound UDP/WebRTC to LiveKit,
                              autoscale on room count) as the deciding constraint
    002-livekit.md            LiveKit Cloud vs self-hosted; region; retention terms per
                              `voice-processor-map.md`
  docker/
    api.Dockerfile            multi-stage, node from .nvmrc, non-root, HEALTHCHECK → /health
    voice-worker.Dockerfile   same; entrypoint `node dist/index.js start`
  environments/
    dev.env.example  staging.env.example  prod.env.example   (names only, no values)
  migrate/
    run.ts                    applies apps/api/src/db/migrations in order inside a
                              transaction per file; records in `schema_migration`;
                              refuses to run if a later-numbered migration is already
                              applied out of sequence without --allow-gap
.github/workflows/
  ci.yml                      (edit) add build-images job on main
  deploy-staging.yml          on main: build → migrate staging → deploy api+worker+web →
                              smoke (X-04 synthetic session) → notify
  deploy-prod.yml             manual dispatch with a tag: same steps, migrate prod, canary
                              1 instance, health for 10 min, then full
apps/api/src/db/migrations/000_schema_migration.sql   the ledger table (numbered 000 so it
                              sorts first; it is the only migration allowed out of ticket
                              order)
```

Secrets: every key in `.env.example` lives in the platform secrets manager per environment;
`ARIA_DEMO_STUDENT_ID` is refused by the API in `NODE_ENV=production` (already) and the
deploy job fails if it is set. Vendor keys are scoped per environment; prod keys never exist
in staging.

Rules:
- Migrations run before the new code starts and must be backward-compatible with the
  previous release (expand → migrate → contract, documented in the runbook), so a rollback
  of code never needs a rollback of schema.
- Rollback is redeploying the previous image tag; it is exercised in staging on every
  release.
- `/health` (P0-24) gates traffic: an instance failing its boot-time provider check never
  receives traffic.
- The web app is served with `VITE_API_BASE_URL` baked per environment; the API sets
  CORS to exactly that origin.

### Edge cases
- Migration fails halfway: transaction per file rolls back that file; ledger unchanged;
  deploy aborts before code ships.
- Two deploys race: the deploy workflow uses a concurrency group per environment.
- Voice worker deploy while sessions are live: worker drains (stops accepting rooms,
  finishes current sessions up to the band's session limit + 2 min, then exits); P2-13's
  outbox resume covers the rare forced restart.
- LiveKit region outage: documented in the runbook; sessions fail with the P0-25 failure
  experience, and the API's `/health` reports `voice: degraded` so the web app offers
  text/tap fallback (P2-07) instead of a broken mic.
- Secret rotation: keys rotated by redeploy; the old key stays valid until health passes.
- Database restore: nightly snapshots, restore tested quarterly in staging and logged in the
  runbook.
- A PR adds a migration with a number already on `main`: CI fails on the duplicate number.

## Acceptance criteria

- [ ] `infra/decisions/001` and `002` are written and approved by the repo owner in the PR.
- [ ] Both images build in CI, run as non-root, pass their HEALTHCHECK.
- [ ] Staging deploys automatically from `main`; prod deploys only by manual dispatch with a
      tag; both are recorded with the image digest.
- [ ] `migrate/run.ts` applies all migrations to an empty database, refuses an out-of-order
      gap, and rolls back a failing file, each proven by a test.
- [ ] A deploy with `ARIA_DEMO_STUDENT_ID` set in prod fails before any instance starts.
- [ ] A staging rollback to the previous tag completes in under five minutes and is
      recorded in the runbook.
- [ ] Worker drain finishes an in-progress voice golden-set session during a deploy with no
      lost or duplicated move (P2-13 test run against staging).
- [ ] No secret value appears in any repository file, CI log or image layer (a CI step
      scans for known key patterns).
- [ ] The X-04 synthetic session passes against staging after every deploy.

## Verification

```bash
docker build -f infra/docker/api.Dockerfile .
docker build -f infra/docker/voice-worker.Dockerfile .
npm run migrate -w @aria/api -- --url "$DATABASE_URL" --dry-run
gh workflow run deploy-staging.yml
```

## References

- `master-plan.md` §4.6, §12.1, §13
- `cloud-model-layer.md` §10 (failure handling), §14 (desktop question)
- `voice-processor-map.md`, `realtime-agent-harness.md` "Worker topology"
- P0-24, P0-25, P2-07, P2-13
