# syntax=docker/dockerfile:1

# The voice worker image.
#
#   docker build -f infra/docker/voice-worker.Dockerfile -t aria-voice-worker .
#
# NOT YET BUILDABLE ON `main`. `apps/voice-worker` arrives with the realtime harness (draft
# PR #18). This file is written now so the deploy path is complete on the day that merges,
# and CI skips building it while the directory is absent — see `.github/workflows/ci.yml`.
#
# It is deliberately the API image with a different entry point. The worker has the same
# runtime constraint for the same reason (the workspace packages publish TypeScript source),
# and two images that drift apart for no reason are two images to debug.
#
# What is different is the shape of the process. The worker is long-lived, holds rooms open
# for the length of a child's session, and must be allowed to *drain* rather than be killed:
# on SIGTERM it stops accepting new rooms and finishes the ones it has. That is why the stop
# timeout in `infra/fly/voice-worker.toml` is minutes rather than seconds, and why nothing
# here sends a second signal.

ARG NODE_VERSION=22

# ── deps ─────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/voice-worker/package.json apps/voice-worker/
COPY packages/shared/package.json packages/shared/
COPY packages/tutor/package.json packages/tutor/

RUN npm ci --ignore-scripts

# ── runtime ──────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache tini

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/voice-worker ./apps/voice-worker

USER node
WORKDIR /app/apps/voice-worker

# The worker serves no HTTP port of its own; liveness is the platform's process check plus
# the room metrics the API's /api/v1/status reports (P0-24, X-04). A HEALTHCHECK here would
# have to invent an endpoint, and an invented endpoint is one that reports health it does
# not have.

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--import", "tsx", "src/index.ts", "start"]
