# P0-03 — API service skeleton (Node + Express + TypeScript)

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Backend |
| **Depends on** | P0-01 |
| **Blocks** | P0-04, P0-10, P0-23, P0-24 |
| **Parallel-safe with** | P0-02, P0-05, P0-06 |
| **Size** | M |

## Why

Every backend ticket after this one adds a router, a service and a repository. If the
layering, error handling, validation and composition are not fixed now, each ticket invents
its own and the tree stops being one codebase.

## Scope

### Build
The Express application shell and the layering contract from `CODE-STANDARDS.md` §3.1, with
one trivial vertical slice (`GET /api/v1/health`) proving the whole path works end to end.

### Do not build
- No auth. That is P0-26 (decision) and a Phase 1 ticket.
- No database. P0-04.
- No AI. P0-10 onward.

## Design

```
apps/api/src/
  app.ts                  composes middleware + routers, exports the app. No listen().
  server.ts               reads config, listens, handles SIGTERM graceful shutdown.
  config/
    env.ts                zod-parsed process.env -> typed AppConfig. Throws at boot.
    index.ts
  routes/
    index.ts              mounts /api/v1
    health.routes.ts
  controllers/
    health.controller.ts
  services/
    health.service.ts
  middleware/
    request-id.ts         attaches a correlation id, echoes x-request-id
    request-logger.ts     structured JSON, never logs bodies
    validate.ts           validate(schema, 'body'|'query'|'params') -> typed req input
    async-handler.ts
    error-handler.ts      last; maps AppError -> status + safe body
    not-found.ts
  errors/
    app-error.ts          AppError base: code, status, safeMessage, cause
    codes.ts              the error code enum
    index.ts
  types/
    http.ts               ApiResponse<T>, ApiError, TypedRequest
  schemas/
    health.schema.ts
  lib/
    logger.ts             pino, redaction list, child logger per request
    clock.ts              Clock port — injected, never Date.now() in a service
    ids.ts                UUID generation port
```

Rules this ticket establishes and every later ticket inherits:

- **`app.ts` never contains business logic.** It applies helmet, cors, json body limit,
  request id, logger, routers, not-found, error handler — in that order.
- **Services are factory functions with injected dependencies.** No singletons, no imports
  of the pool or the logger inside a service body.
- **Controllers are thin.** Validate (via middleware), call one service, map to a response.
  A controller with an `if` chain about business rules has failed review.
- **One error shape.** `{ error: { code, message, requestId } }`. Status codes come from
  `AppError.status`; unknown errors are 500 with a generic message.
- **The logger redacts.** `authorization`, `api-key`, `x-api-key`, `password`, `token`,
  `prompt`, `name`, `email` are in the redaction list from day one.

## Acceptance criteria

- [ ] `GET /api/v1/health` returns `200 { status, version, uptimeSeconds }`.
- [ ] A missing required env var fails at boot with a message naming the variable, and the
      process exits non-zero. It never fails later, in front of a child.
- [ ] An unhandled rejection inside a controller returns the standard 500 body, is logged
      with the request id, and leaks no stack trace to the client.
- [ ] An unknown route returns the standard 404 body.
- [ ] Supertest integration tests cover health, 404 and the error path.
- [ ] A service unit test constructs the service with fakes and never imports Express.
- [ ] `SIGTERM` stops accepting connections, drains in-flight requests, then exits 0.

## Verification

```bash
npm run test -w @aria/api
npm run dev -w @aria/api & curl -s localhost:3000/api/v1/health | jq
```

## References

- `CODE-STANDARDS.md` §3.1, §5
- `master-plan.md` §10 (the API surface these routers will grow into)
