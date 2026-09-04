-- 028 — X-05: a request that arrives twice, and a budget that can be spent
--
-- Two tables, both bookkeeping rather than domain. Neither is read by the tutor and neither
-- outlives its purpose: rows here are evidence about traffic, not about a child, and both are
-- reaped rather than kept.
--
-- The migration is numbered 028 by the ticket map in dev-docs/tickets/README.md, not by merge
-- order (AGENT-INSTRUCTIONS §4). It lands ahead of 012–027 and the runner allows that with
-- `--allow-gap`; nothing here depends on a table those will add.

-- ── A request the client already made ───────────────────────────────────────────────────
--
-- A child on a slow connection taps "answer" twice; a phone retries a POST it never saw the
-- response to. Without this the second copy runs the turn again — a second model call, a
-- second `session_event`, and a tutor that has moved on from the question the child answered.
--
-- The stored response is what makes a replay honest: the retry receives what the first attempt
-- produced, byte for byte, rather than a fresh answer to a question that was already asked.
CREATE TABLE idempotency_record (
    -- The key the client chose, scoped to who they are and what they called. A key is only
    -- ever unique to its author: the same UUID from two children is two requests.
    key           TEXT        NOT NULL CHECK (length(btrim(key)) BETWEEN 8 AND 200),
    actor_class   TEXT        NOT NULL CHECK (actor_class IN
                                ('student', 'parent', 'device', 'worker', 'anonymous')),
    actor_id      TEXT        NOT NULL CHECK (length(btrim(actor_id)) BETWEEN 1 AND 200),
    route         TEXT        NOT NULL CHECK (length(btrim(route)) BETWEEN 1 AND 200),

    -- SHA-256 of the request body. The same key with a different body is a client bug that
    -- would otherwise be served a stranger's answer, so it is refused rather than replayed.
    -- Hashed, not stored: a body can contain a child's own words, and this table has no
    -- business holding them (P0-23).
    request_hash  TEXT        NOT NULL CHECK (length(request_hash) = 64),

    -- Null while the first attempt is still running. A second request arriving in that window
    -- has nothing to replay yet and is told to retry, which is the honest answer: the work is
    -- in flight and duplicating it is the thing we are here to prevent.
    status_code   INTEGER     CHECK (status_code BETWEEN 100 AND 599),
    response_body JSONB,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at  TIMESTAMPTZ,
    -- Reaped rather than kept. 24h is long enough to cover any retry a client will make and
    -- short enough that this never becomes a log of what a child did.
    expires_at    TIMESTAMPTZ NOT NULL,

    PRIMARY KEY (actor_class, actor_id, route, key)
);

-- The reaper's index. Partial on nothing, because every row expires and the sweep wants them
-- in expiry order.
CREATE INDEX idempotency_record_expiry_idx ON idempotency_record (expires_at);

-- ── A budget, per actor, per kind of work ───────────────────────────────────────────────
--
-- One row per (actor, route class), holding a token bucket as two numbers: what was left, and
-- when that was true. Refill is arithmetic against `updated_at`, so there is no window edge to
-- line up against and no row per request.
--
-- This table exists for deployments running more than one API instance, where a bucket in
-- process memory means each instance grants the whole limit independently. A single instance
-- uses the in-memory adapter and never touches this.
CREATE TABLE rate_limit_bucket (
    actor_class TEXT        NOT NULL CHECK (actor_class IN
                              ('student', 'parent', 'device', 'worker', 'anonymous')),
    actor_id    TEXT        NOT NULL CHECK (length(btrim(actor_id)) BETWEEN 1 AND 200),
    route_class TEXT        NOT NULL CHECK (route_class IN
                              ('turn', 'session', 'read', 'auth', 'mutation')),

    -- Fractional on purpose: a bucket refilling at 20/minute gains a third of a token every
    -- second, and rounding that down to zero would refill nothing at all.
    tokens      REAL        NOT NULL CHECK (tokens >= 0),
    -- Always the database's own `now()`. A server whose clock jumps must not be able to mint
    -- tokens, so the value written and the value compared come from the same source.
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (actor_class, actor_id, route_class)
);

CREATE INDEX rate_limit_bucket_stale_idx ON rate_limit_bucket (updated_at);
