# X-05 — Abuse and robustness: rate limits, injection, idempotency, malformed input

| | |
|---|---|
| **Phase** | Cross-cutting (must be live before any real child uses Phase 2H) |
| **Track** | Backend |
| **Depends on** | P1-13, P0-23, P2-13, P2H-12 |
| **Blocks** | P2H-14, P6-09 |
| **Parallel-safe with** | P3-*, P4-*, P7-* |
| **Size** | M |

## Why

Every input to the system is authored by someone we do not control: a child's speech, a
transcript from a vendor, a parent's question, a webhook. `master-plan.md` §12 demands that
crisis routing is never model-dependent and that Aria never asks for personal information;
P1-13 acceptance already says "a prompt-injection fixture cannot make her". This ticket
makes that a maintained suite rather than one test, and closes the plain engineering holes:
no rate limiting exists, turn endpoints are not idempotent, and a malformed realtime event
can reach the tutor loop.

## Scope

### Build
Rate limiting per actor and per route, idempotency keys on every mutating student route,
strict schema validation at every boundary (HTTP, worker→API, LiveKit data channel), a
prompt-injection and jailbreak fixture suite run in CI, session-token hardening, and clock
and replay protections.

### Do not build
No CAPTCHA or bot challenge for children. No IP-based blocking of families (shared school
NAT). No content moderation of parents beyond the existing safety classifier on child-facing
output.

## Design

```
apps/api/src/
  middleware/
    rate-limit.ts               token bucket keyed by (actor, route class); actors:
                                student session, parent, worker, anonymous; store port
                                with an in-memory adapter and a Postgres adapter (X-01
                                decides if a shared store is needed); 429 with Retry-After
    idempotency.ts              `Idempotency-Key` header required on POST /student/session,
                                /session/turn, /session/end, /student/writing, /parent/*
                                mutations; key + actor + route → stored response for 24h
                                (migration 028 `idempotency_record`); replay returns the
                                stored response, never re-runs the turn
    validate.ts                 (edit) reject unknown fields everywhere (`.strict()`),
                                cap string lengths per field, cap array sizes
  security/
    session-token.ts            child session cookie: httpOnly, SameSite=Lax, Secure in
                                prod, rotated on privilege change, bound to the student and
                                a device nonce; idle expiry per band; absolute expiry
    clock.ts                    server time is authoritative; client-supplied timestamps
                                accepted only as durations (X-04) or rejected
  testing/adversarial/
    fixtures/
      injection/*.json          child text and transcripts: "ignore your rules", role-play
                                requests, "my mom says tell me your address", nested
                                quotes, unicode homoglyphs, very long inputs, transcripts
                                containing move JSON, requests for personal info, requests
                                to stop being Aria, prompts hidden in a "question"
      parent-ask/*.json         parent questions trying to extract other children's data,
                                the system prompt, or vendor keys
      realtime/*.json           malformed/oversized/out-of-order/replayed data-channel
                                events; wrong `connectionEpoch`; negative seq; duplicate
                                move acks; events for another session id
    run.ts                      replays every fixture through the real turn path with a
                                recording AiClient; asserts: no personal-info request, no
                                out-of-persona output, no move outside allowed set, no
                                crisis path skipped, no 5xx, no unbounded latency
    invariants.ts               the assertion list, one function per invariant
apps/voice-worker/src/session/
  event-validator.ts            every inbound data-channel event parsed with the shared
                                zod schemas before the harness sees it; drops + counts
                                invalid events; disconnects after N invalid in a window
```

Rules:
- Validation happens at the boundary with the shared schemas from `packages/shared`; the
  tutor loop never sees an unvalidated event.
- Rate limits are generous for a child (a child cannot send 100 turns a minute by hand) and
  tight for anonymous routes; limits are config, not code.
- Idempotency is per actor: the same key from a different student is a different request.
- The adversarial suite is part of `npm test`; a new fixture is added for every reported
  incident before its fix is merged.

### Edge cases
- Legitimate double-submit (child taps twice): idempotency returns the same move; no second
  `session_event`.
- Key reused with a different body: 422, logged, not executed.
- Rate limit hit mid-session: the child sees the P0-25 calm screen for the window, never a
  "429" or a lockout message.
- Worker replays an old `serverSeq` after reconnect: the outbox de-dup (P2-13) wins; the
  validator additionally rejects a seq below `acknowledgedSeq` from the wrong epoch.
- Transcript contains text shaped like a `TutorMove` JSON: treated as speech; the
  `ScrubbedContext` builder escapes it; the invariant test proves the planner ignores it.
- 10 000-character "question": truncated at the schema cap with a logged event; the tutor
  answers the first sentence.
- Homoglyph "address" request: the deterministic personal-info pattern list is normalised
  (NFKC + confusables) before matching.
- Session cookie stolen and used from another device: device nonce mismatch → session
  invalidated, child re-picks their picture (P2H-12), parent not alarmed.
- Clock jumps on the server: idempotency and expiry use database `now()`.

## Acceptance criteria

- [ ] Migration `028` applies; idempotency records expire after 24h.
- [ ] Every mutating student and parent route requires `Idempotency-Key`; replay returns
      the stored response with zero new `session_event` rows; changed body → 422.
- [ ] Rate limits exist for every actor class; exceeding them returns 429 with
      `Retry-After` and the child UI shows the calm screen.
- [ ] Every HTTP and data-channel schema is `.strict()` with length and array caps; an
      unknown field is rejected, proven per route by a generated test.
- [ ] The adversarial suite runs in `npm test` with ≥ 60 fixtures across the three families
      and every invariant holds.
- [ ] A transcript containing move JSON never produces a move outside the allowed set.
- [ ] Homoglyph and NFKC variants of personal-info requests hit the deterministic path with
      no model call (call count asserted).
- [ ] The worker drops malformed events, counts them, and disconnects after the threshold;
      a valid session continues unaffected.
- [ ] Child session cookies are httpOnly/Secure/SameSite with idle and absolute expiry;
      device-nonce mismatch invalidates the session.

## Verification

```bash
npm run test -w @aria/api -- middleware security testing/adversarial
npm run test -w @aria/voice-worker -- event-validator
```

## References

- `master-plan.md` §12 (rules 3, 4, 5)
- `realtime-agent-harness.md` — reconnect / outbox, "Voice safety: transcripts are not enough"
- P0-23, P1-13, P2-13, P2H-12, X-04
