# syntax=docker/dockerfile:1

# The web image: a Vite build served by nginx.
#
#   docker build -f infra/docker/web.Dockerfile \
#     --build-arg VITE_API_BASE_URL=https://api.staging.aria.example -t aria-web .
#
# `VITE_API_BASE_URL` is a build argument, not an environment variable, because Vite inlines
# it into the bundle. One image therefore belongs to exactly one environment, which is the
# point: a staging bundle can never be promoted to production still pointing at staging's API.
# The API's CORS list is set to exactly this origin (X-01).

ARG NODE_VERSION=22

# ── build ────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/tutor/package.json packages/tutor/
RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web

ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build -w @aria/web

# ── runtime ──────────────────────────────────────────────────
# The unprivileged nginx image rather than the stock one: it listens on 8080, runs as a
# non-root user, and keeps its pid file somewhere that user can write. Patching the stock
# image to do the same is three `sed` calls that break on the next nginx release.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY infra/docker/web.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
