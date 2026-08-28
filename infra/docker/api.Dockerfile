# syntax=docker/dockerfile:1

# The API image.
#
# Build from the repository root: the API imports `@aria/shared` and `@aria/tutor`, which are
# workspace packages, so the build context is the workspace and not `apps/api`.
#
#   docker build -f infra/docker/api.Dockerfile -t aria-api .
#
# It runs TypeScript through `tsx` rather than shipping a compiled bundle, and that is a
# decision rather than an omission: `packages/shared` and `packages/tutor` publish
# `./src/index.ts` from their `exports`, so *something* has to transpile at runtime no matter
# what this file does. Bundling instead would break the two assets the API reads by relative
# path — `config/ai.yaml` and `src/db/migrations/*.sql` — because a bundler collapses the
# directory depth those paths are written against. `infra/decisions/001-hosting.md` records
# what would have to change first.

ARG NODE_VERSION=22

# ── deps ─────────────────────────────────────────────────────
# Separated so a change to source code does not re-run `npm ci`. Only the manifests are
# copied here, which is what keeps this layer cached across ordinary commits.
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/tutor/package.json packages/tutor/

# Runtime dependencies only. Without `--omit=dev` the image also carries the whole
# workspace's toolchain — TypeScript, Playwright, Vite, React — which is 185MB of things the
# API never calls. (`--workspace` flags are not the way to do this: combined with
# `--include-workspace-root` they make npm ignore `--omit` and install everything anyway.)
#
# `tsx` is then added back deliberately, because it *is* the runtime here — see the header —
# and it is the one development dependency this image needs. Pinned to the major the
# workspace develops against.
#
# `--ignore-scripts`: no dependency of this workspace needs a postinstall, and one that
# suddenly does should be noticed rather than executed during an image build.
RUN npm ci --ignore-scripts --omit=dev \
 && npm install --ignore-scripts --no-package-lock --prefix /opt/tsx tsx@^4.23.12 \
 && cp -R /opt/tsx/node_modules/. /app/node_modules/ \
 && rm -rf /opt/tsx /root/.npm

# ── runtime ──────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app

# `tini` reaps zombies and forwards signals, so the graceful shutdown the server already
# implements actually receives the SIGTERM a deploy sends it.
RUN apk add --no-cache tini curl

ENV NODE_ENV=production \
    API_PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api

# The source tree is read-only to the process that runs it, and the process is not root.
# Both are true in one line because the image contains nothing this user needs to write.
USER node

WORKDIR /app/apps/api
EXPOSE 3000

# The container is unhealthy the moment the API stops answering, which is what the platform
# reads to decide whether an instance receives traffic (P0-24, X-01 rollout gate).
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${API_PORT}/api/v1/health" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--import", "tsx", "src/index.ts"]
