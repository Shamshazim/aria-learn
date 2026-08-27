# 001 — Where Aria runs

| | |
|---|---|
| **Status** | Proposed — needs the repo owner's approval in the X-01 pull request |
| **Date** | 2026-08-26 |
| **Ticket** | X-01 |
| **Supersedes** | — |

## The decision

**Containers on Fly.io, with Postgres from Supabase.**

| Component | Home | Why there |
|---|---|---|
| `apps/api` | Fly app, 2+ machines | Stateless HTTP. Health-gated rollout is native. |
| `apps/voice-worker` | Fly app, scaled on rooms | Long-lived process holding WebRTC sessions open. |
| `apps/web` | Fly app, nginx, 1 machine | Static bundle. A CDN in front of it is a later, additive change. |
| PostgreSQL | Supabase | Already the identity provider (P0-26, P0-28). One vendor, one bill, one support relationship. |
| LiveKit | Decision 002 | |
| Secrets | `fly secrets` per app and environment | Never in an image layer, never in the repository. |

Three environments — `dev`, `staging`, `prod` — as three sets of apps with the same
configuration and different sizes. Names are suffixed (`aria-api-staging`), which is why the
Fly configs in `infra/fly/` name no environment: the app is passed on the command line.

## The constraint that decided it

Everything Aria runs today is a request handler, and request handlers run anywhere. The voice
worker is not. It:

- holds a room open for the length of a child's session — up to thirty minutes for a senior
  band, which is longer than most serverless platforms will run anything;
- speaks WebRTC **outbound** to LiveKit, so it needs egress and a stable process, not an
  ingress route;
- scales on concurrent rooms rather than on requests per second;
- must **drain** on deploy: stop accepting rooms, finish the ones it holds.

That rules out anything request-scoped. What remains is "run a container for a long time",
which every container PaaS does and which does not need an orchestrator.

## What was rejected, and why

**Kubernetes.** The ticket asks for a reason a PaaS cannot host the voice worker before
reaching for this. There isn't one. A cluster would add a control plane, a networking model
and an upgrade cadence to a team that is currently one person and an agent, in exchange for
autoscaling behaviour Fly gives us as a line of TOML. Revisit at the scale P7 describes.

**AWS ECS Fargate + RDS.** The most control and the least lock-in, and genuinely the right
answer eventually. Today it is several hundred lines of infrastructure code and an IAM model
to maintain before the first child sees anything, and X-01 blocks four other tickets.

**Render.** A close second and a defensible choice. One dashboard, managed Postgres included,
a first-class background-worker type that fits the voice worker exactly. It loses on two
points: Postgres would be a second database vendor beside the Supabase one that already holds
adult identities, and per-machine placement control matters for a workload measured in
concurrent audio rooms.

**Vercel for the web app.** Better previews and a better CDN than nginx on Fly. Deferred
rather than rejected: it splits secrets and deploys across two platforms for a benefit that
matters most when there are many contributors. The web image is a plain static bundle, so
moving it later costs one workflow file.

**Fly Postgres.** Fly is explicit that it is unmanaged — no automatic failover, backups are
the operator's problem. For a database holding children's learning history, that is not a
trade to make to save a vendor.

## Consequences

- **Migrations run from CI, not from the app.** The API also runs them at boot, which stays as
  a safety net; the deploy job is what gates a release on them.
- **The web bundle belongs to one environment.** `VITE_API_BASE_URL` is inlined at build time,
  so a staging image cannot be promoted to production. The smoke check asserts it.
- **CORS is exact.** The API's `CORS_ORIGINS` is set to precisely the web app's origin per
  environment — which is the variable this ticket had to add to `.env.example`, because the
  API read it and nothing documented it.
- **Region is single.** `iad` to start, chosen to sit near Supabase's default US East region;
  multi-region is deferred explicitly by `BACKLOG.md`.
- **No desktop packaging.** `cloud-model-layer.md` §14's open question is answered here as
  **web only**, matching CLAUDE.md's "hosted only, no offline mode". Product can override in
  the pull request.

## The image runs TypeScript through `tsx`

Worth recording, because it looks like an oversight and is not.

`packages/shared` and `packages/tutor` publish `./src/index.ts` from their `exports`. Something
has to transpile at runtime no matter what the Dockerfile does. Bundling instead — the obvious
alternative — breaks the two files the API reads by relative path, `config/ai.yaml` and
`src/db/migrations/*.sql`, because a bundler collapses the directory depth those paths are
written against.

Bundling becomes worth doing when either of those changes: the workspace packages gain a build
step that emits JavaScript, or the two asset paths come from configuration instead of from
module-relative URLs. Neither is X-01's to change. The cost meanwhile is a larger image and a
second or so of boot, against a health check with a 30-second grace period.
