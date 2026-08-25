# P6-07 — Crisis escalation delivery

| | |
|---|---|
| **Phase** | 6 |
| **Track** | Backend |
| **Depends on** | P1-13 |
| **Blocks** | P6-02, P6-05, P6-09 |
| **Parallel-safe with** | P6-01, P6-03, P6-04, P6-06, P6-08 |
| **Size** | M |

## Why

`master-plan.md` §12.5: "Crisis language routes to a human immediately… This path is tested
and never model-dependent." P1-13 detects, responds with fixed text and picks a route from
the matrix — and then `escalate()` calls an `EscalationPort.notify` that nobody implements.
Today a child in crisis gets a gentle sentence and no human is reached. This is the most
important unfinished ticket in the product.

## Scope

### Build
The `EscalationPort` implementation: an emergency-contact model, SMS / email / voice-call /
hotline-handoff adapters, retry and acknowledgement, on-call fallback, an audit trail, and a
test harness that proves every matrix row reaches its named route with every model disabled.

### Do not build
No model anywhere on this path. No in-app "chat with a counsellor". No change to the matrix
wording without a safeguarding professional's review.

## Design

```sql
-- migration 022
emergency_contact  id UUID PK, parent_id UUID NOT NULL REFERENCES parent(id) ON DELETE CASCADE,
                   student_id UUID REFERENCES student(id) ON DELETE CASCADE,   -- null = all children
                   kind VARCHAR(16) NOT NULL,        -- 'parent' | 'designated'
                   name TEXT NOT NULL, phone TEXT, email CITEXT,
                   verified_at TIMESTAMPTZ, priority SMALLINT NOT NULL DEFAULT 1
escalation         id UUID PK, safety_flag_id UUID NOT NULL REFERENCES safety_flag(id) ON DELETE CASCADE,
                   route VARCHAR(32) NOT NULL, channel VARCHAR(16) NOT NULL,
                   target_ref TEXT NOT NULL,         -- contact id or hotline id, never raw number
                   attempted_at TIMESTAMPTZ NOT NULL, delivered_at TIMESTAMPTZ,
                   acknowledged_at TIMESTAMPTZ, error TEXT, attempt SMALLINT NOT NULL
safety_flag        + parent_visible BOOLEAN NOT NULL DEFAULT false   (set from the matrix row)
```

```
apps/api/src/safety/escalation/
  escalation.service.ts      implements EscalationPort.notify; fan-out per matrix row
  routes/
    parent.route.ts          all verified parent contacts, SMS then email then call
    emergency-contact.route.ts designated contacts first; falls back to parent only if the
                             matrix row allows (household_abuse: never)
    safeguarding-handoff.route.ts hotline / safeguarding partner API or staffed line;
                             configured per region; includes only what the partner needs
  channels/sms.port.ts, email.port.ts, voice-call.port.ts, hotline.port.ts
  adapters/twilio-sms.adapter.ts, twilio-call.adapter.ts, resend-email.adapter.ts,
           hotline-webhook.adapter.ts
  retry.ts                   1m, 5m, 15m, then on-call
  oncall.ts                  pages the Aria on-call safeguarding responder when no route
                             acknowledges within the row's SLA
  ack.ts                     inbound webhook / reply handling => acknowledged_at
  templates/                 reviewed message text per (category, channel, route); no child
                             quote in SMS; transcript link only where parent_visible
apps/api/src/safety/crisis/matrix.ts   + per-row: channels[], sla_minutes, parent_visible,
                                       message_key
apps/api/src/repositories/emergency-contact.repository.ts, escalation.repository.ts
apps/api/src/controllers/parent/emergency-contacts.controller.ts   (+ routes in P6-01 shell)
```

Rules:
- Deterministic end to end. Adapters are thin; routing, ordering and retry are code with
  tests. No LLM import is permitted anywhere under `safety/escalation/` — enforced by lint.
- Matrix row → channels in order; the first delivered channel does not stop the others for
  `critical` severity (all fire); for `moderate` the first delivery stops the fan-out.
- `household_abuse` never contacts the parent, never contacts a designated contact who
  shares the household (contact has a `same_household` flag), and never sets
  `parent_visible`. Only the safeguarding handoff.
- Messages carry: child first name, category in reviewed plain words, time, what Aria said,
  and what to do now. Never the child's quoted words over SMS/email.
- Acknowledgement: reply "OK" to SMS, click in email, keypress in call, webhook from hotline.
  Unacknowledged after `sla_minutes` → next channel → on-call page.
- The child-facing side is unchanged (P1-13): gentle fixed text, session paused, no threat.
- Every attempt is audited; the parent-visible flag drives P6-05 and P6-02.
- Contacts are verified (SMS code / email link) before they can be a route; an unverified
  contact is skipped, and a parent with no verified contact is warned at every parent page
  load and by email until fixed.

### Edge cases
- No verified contacts at all → `parent` route falls through to on-call immediately; the
  on-call page includes that fact.
- Region without a hotline integration → `safeguarding_handoff` goes to the Aria on-call
  responder, who owns the handoff; recorded as `channel='oncall'`.
- SMS provider outage → email and call fire; provider error stored; retry continues.
- Child triggers two flags in one minute → one escalation per flag, but messages are
  coalesced within 2 minutes per contact.
- Flag raised at 3 a.m. → same behaviour; there is no quiet-hours rule on this path.
- Parent account deleted after the flag → escalation rows cascade; the on-call record keeps
  the tombstone id only.
- Test environment → all adapters are fakes; a production boot without a configured
  safeguarding route for the deployment region refuses to start (health check).
- Low-confidence near-miss (P1-13) → `needs_review` queue for the on-call responder within
  24h, not an emergency page.

## Acceptance criteria

- [ ] With every model disabled, a fixture flag for each of the four categories reaches the
      route the matrix names, on the channels in order, proven by fake adapters that record
      calls.
- [ ] `household_abuse` never produces a parent or same-household contact attempt, and
      `parent_visible` is false; a test asserts zero calls.
- [ ] Unacknowledged critical escalation pages on-call after the SLA; acknowledgement stops
      the ladder; both tested with a fake clock.
- [ ] Provider failure on one channel does not block the others; retry schedule tested.
- [ ] No message template contains the child's quoted text; a test greps every template.
- [ ] Lint rule: no import from `ai/` under `safety/escalation/`.
- [ ] Production boot fails without a configured safeguarding route.
- [ ] Migration `022` applies; every attempt is audited.
- [ ] Matrix additions (channels, SLAs, wording) reviewed by a safeguarding professional;
      review recorded in the PR.

## Verification

```bash
npm run test -w @aria/api -- escalation
npm run golden:tutoring -w @aria/api -- --scenario safety-disclosure
npm run escalation:drill -w @aria/api -- --category self_harm --dry-run
```

## References

- `master-plan.md` §3 (gap 9), §12.4, §12.5; P1-13 and its 2026-08-23 amendment;
  `apps/api/src/safety/crisis/{escalate,matrix}.ts`
