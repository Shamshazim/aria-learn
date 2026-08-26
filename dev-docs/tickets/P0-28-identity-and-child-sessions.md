# P0-28 — Implement adult identity and child device sessions

> **Delivered 2026-08-25 by [P2H-12](P2H-12-identity-and-child-sessions.md).** P2H-12 restates
> this ticket against the tree as it now stands — migration 009, `auth/`, the child picker —
> and its Status section records what was built, what was decided differently and what is left.
> This file stays as the original statement of the requirement.

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Backend + Frontend |
| **Depends on** | P0-04, P0-26 |
| **Blocks** | P1-05 auth middleware, parent and teacher work |
| **Size** | L |

## Why

P0-26 chose managed Supabase Auth for adults and Aria-owned sessions for children. This
ticket implements that boundary without turning children into identity-provider users.

## Scope

### Build

- An `AdultIdentityProvider` port and Supabase adapter for email magic-link login, token
  verification, session revocation and hard user deletion.
- Parent and teacher identity links keyed by provider subject. No authorization role or
  child fact lives in provider metadata.
- The adult age/role gate and consent record. A child profile cannot be created or opened
  until the required parent or authorised-school consent is active.
- Parent-owned child profiles using a nickname, a parent-chosen picture and a hashed
  four-picture secret.
- Revocable device grants scoped to selected child profiles, plus child sessions with a
  30-minute idle and four-hour absolute lifetime.
- Adult sessions with 15-minute access tokens, rotating refresh, 7-day inactivity and
  30-day absolute lifetime. Sensitive parent actions check a fresh adult verification and
  live provider session.
- One deletion orchestrator: revoke grants and sessions, delete child/account data, remove
  owned storage, then hard-delete the adult provider identity. A deletion ledger is replayed
  after database restores.
- Parent device listing and revocation. Teacher class linking requires parent approval or a
  recorded authorised-school consent source.

### Do not build

- No custom password database or token issuer.
- No child email, phone, social login, full name or identity-provider account.
- No school rostering, SSO or district administration UI.
- No desktop shell. Keep the server contract usable by a later OS credential store.

## Acceptance criteria

- [ ] A parent can complete a magic-link login and create a child only after consent.
- [ ] A five-year-old can reopen an authorised profile using pictures only.
- [ ] Child grants cannot call parent, sibling or teacher endpoints.
- [ ] Provider tokens with missing, deleted or mismatched Aria identity rows are rejected.
- [ ] Revocation takes effect immediately, including against an otherwise unexpired JWT on
      sensitive endpoints.
- [ ] Deleting a child removes all child-owned rows and objects without touching siblings.
- [ ] Deleting an adult removes all owned data, grants and provider identity; partial
      failures are durable and retryable.
- [ ] No child field appears in identity-provider requests, logs or metadata, enforced by a
      boundary test.
- [ ] Cost-sensitive provider calls are integration-tested against a local fake; live
      credentials are not required for the normal test suite.

## Verification

```bash
npm run check
```

## References

- P0-26 and `rewrite.md` §6 — binding decision and exact lifetimes
- FTC COPPA FAQ — consent, access, minimisation and deletion
- Supabase Auth documentation — sessions, deletion and magic links
