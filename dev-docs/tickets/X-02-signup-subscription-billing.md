# X-02 — Signup, subscription and billing

| | |
|---|---|
| **Phase** | Cross-cutting (needed for Phase 6 exit: "a parent renews") |
| **Track** | Decision + Backend + Frontend |
| **Depends on** | P2H-12, X-01 |
| **Blocks** | P6-01, P6-09, P7-04, P7-05 |
| **Parallel-safe with** | P3-*, P4-* |
| **Size** | M |

## Why

`master-plan.md` §7: "a parent buys this for their own child first"; §13 Phase 6 exit: "a
parent renews without being asked"; §12.7: "no advertising, ever, no selling data, ever."
There is no way to pay, no trial, no entitlement check, and the plain-language cloud
disclosure that §12.1 demands at signup has nowhere to live. P7-04's cost-per-child number
has no price to be compared with.

## Scope

### Decide
Consumer price (monthly and yearly), trial length, per-family child count, and the payment
provider — recorded in `dev-docs/decisions/pricing.md` before code.

### Build
Signup flow with the cloud disclosure, a `PaymentProvider` port with one adapter, the
`subscription` table, webhook handling, entitlement middleware on student routes, grace
period, cancellation, and the parent-facing billing page.

### Do not build
No ads, no data sale, no upsell inside the child's session — ever. No usage-based pricing
shown to the child. No school/district plans (§14). No in-app purchase of "extra hints" or
anything a child could trigger.

## Design

```sql
-- migration 027_subscription.sql
subscription  id UUID PK, parent_id UUID REFERENCES parent(id) ON DELETE CASCADE,
              provider VARCHAR(32) NOT NULL, provider_customer_id TEXT NOT NULL,
              provider_subscription_id TEXT UNIQUE,
              plan VARCHAR(32) NOT NULL,            -- trial | monthly | yearly
              status VARCHAR(32) NOT NULL,          -- trialing | active | past_due | canceled | expired
              child_limit SMALLINT NOT NULL DEFAULT 3,
              trial_ends_at TIMESTAMPTZ, current_period_end TIMESTAMPTZ,
              canceled_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
subscription_event  id UUID PK, subscription_id UUID, provider_event_id TEXT UNIQUE,
              kind VARCHAR(64), payload JSONB, received_at TIMESTAMPTZ
```

```
apps/api/src/
  billing/
    payment-provider.port.ts      createCheckout, createPortalSession, verifyWebhook,
                                  parseEvent → normalised SubscriptionEvent
    adapters/stripe.adapter.ts    (or the decided provider); the only file importing its SDK
    entitlement.service.ts        isEntitled(parentId) → { entitled, reason, graceUntil }
    subscription.service.ts       state machine: trialing→active→past_due→(active|expired),
                                  →canceled at period end; idempotent on webhook replay
    webhook.controller.ts         verifies signature, stores event, applies transition
  middleware/require-entitlement.ts   on every /student/* route after student-access;
                                  unentitled → 402 with a parent-facing code, never a
                                  child-facing paywall (the child sees the P0-25 "not
                                  right now" screen; the parent gets the reason)
  routes/billing.routes.ts        POST /parent/billing/checkout, /portal, POST /billing/webhook
  repositories/subscription.repository.ts
apps/web/src/features/signup/
  DisclosureStep.tsx              §12.1 in plain words: what is sent, to which vendor
                                  (from ai.yaml endpoint names + voice-processor-map.md),
                                  why; explicit checkbox; version of the wording recorded on
                                  the parent row
  PlanStep.tsx  BillingPage.tsx
dev-docs/decisions/pricing.md
```

Rules:
- Entitlement is checked server-side on every student request; the client's idea of a plan
  is never trusted.
- Trial requires no card unless `pricing.md` decides otherwise; the decision is recorded.
- The disclosure wording is versioned; changing it re-prompts existing parents at next
  login.
- Cancellation keeps full access until `current_period_end`; data is retained per P6-06
  (deletion is the parent's explicit action, never a side effect of not paying).

### Edge cases
- Webhook arrives before the checkout redirect returns: the subscription row is created by
  the webhook; the redirect handler is idempotent.
- Duplicate or out-of-order webhooks: `provider_event_id` unique; transitions compare
  provider timestamps and ignore stale events.
- Payment fails: `past_due` with a 7-day grace (config); the child's sessions continue
  through grace; the parent is emailed once, not daily.
- Trial ends mid-session: the current session finishes; the next arrival is unentitled.
- Parent has more children than `child_limit`: cannot add another; existing children keep
  access.
- Provider outage during checkout: parent sees a retry page; nothing is written.
- Refund/chargeback: `subscription_event` records it; status → `canceled` at once; a
  P6-06 deletion is *not* triggered automatically.
- Two parents on one family: out of scope; one paying parent per family, recorded in
  `pricing.md`.

## Acceptance criteria

- [ ] `pricing.md` records price, trial, child limit, provider, and the no-card decision.
- [ ] Migration `027` applies; cascades from `parent`; `provider_event_id` unique.
- [ ] The state machine is unit tested for every transition including replay and
      out-of-order events.
- [ ] Webhook signature verification rejects a tampered payload.
- [ ] An unentitled parent's child gets a 402 on `/student/*` and the P0-25 screen; the
      child never sees a price or a paywall.
- [ ] Grace period keeps sessions running for `past_due`; expiry ends them at the next
      arrival, not mid-session.
- [ ] The disclosure step lists the actual configured vendors and must be accepted before
      any child row exists; the accepted version is stored.
- [ ] Cancelling does not delete anything; a test proves rows remain.
- [ ] No code path in `apps/web/src/features/session` or `packages/tutor` imports anything
      from `billing/` (lint rule).

## Verification

```bash
npm run test -w @aria/api -- billing middleware/require-entitlement
npm run test -w @aria/web -- signup
```

## References

- `master-plan.md` §7, §12.1, §12.7, §13 Phase 6, §14
- `cloud-model-layer.md` §9
- P0-25, P2H-12, P6-06, P7-04
