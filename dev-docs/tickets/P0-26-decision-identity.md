# P0-26 — Decision: identity and accounts

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Decision |
| **Depends on** | — |
| **Blocks** | P1-05 auth middleware, every parent/teacher ticket in Phase 6 |
| **Parallel-safe with** | all of Phase 0 |
| **Size** | S (decision) + separate implementation ticket |

## Why

Cloud-only made an Aria account **mandatory** — we hold the vendor key, so there is no
key-less path (`cloud-model-layer.md` §7). Identity is required but it is not our
differentiator, and `rewrite.md` §6 leaves the build-vs-buy question deliberately open. Every
authenticated endpoint is blocked on the answer, so it is answered early and once.

## Scope

### Produce
A written decision, appended to `rewrite.md` §6 and this ticket, covering:

1. **Build or buy.** A hosted identity provider (Auth0, Clerk, WorkOS, Supabase Auth) versus
   our own email/password and session handling.
2. **The account model.** A parent account owning child profiles; children do not have email
   addresses. How a child signs in on a shared family device without typing a password.
   How a teacher account relates to a class.
3. **Child-safety obligations.** COPPA and equivalents: parental consent, no child email, no
   marketing to children, and what the age gate looks like.
4. **Session handling.** Token lifetime, refresh, revocation, and what happens on a shared
   device.
5. **Cost and lock-in** at 1,000 and 100,000 children.

### Do not produce
No implementation. That is a separate ticket written once this is decided.

## Constraints the decision must satisfy

- Account and identifying data stay inside Aria's service boundary (`master-plan.md` §12.2).
  A vendor that requires storing a child's full name off-platform is disqualified.
- "Delete means delete" (§12.9) must be implementable end to end, including at the identity
  vendor.
- The parent can see everything about their child (§7). Nothing about a child is hidden from
  their parent.
- A five-year-old must be able to start a session **without reading anything**. Whatever the
  sign-in is, it cannot require a non-reader to type.
- The desktop question (`rewrite.md` §6) must not be pre-empted: the answer has to work for a
  web app and remain workable if a desktop shell is later approved.

## Acceptance criteria

- [ ] A recommendation with a stated reason, not a survey of options.
- [ ] Each constraint above explicitly satisfied or explicitly waived with a reason.
- [ ] A cost estimate at both scales.
- [ ] The child sign-in flow described concretely enough to build.
- [ ] `rewrite.md` §6 updated to record the answer and close the question.
- [ ] A follow-up implementation ticket written and numbered.

## References

- `rewrite.md` §6, `cloud-model-layer.md` §7, `master-plan.md` §7, §12

## Decision — 2026-08-24

**Buy managed Supabase Auth, for adults only.** Aria owns an identity-provider port and all
authorization. Supabase authenticates parent and teacher email identities; it never receives
a child profile or child identifier. The full rationale, flows, compliance rules, session
lifetimes, deletion sequence, cost estimate and cited primary sources are recorded in
`rewrite.md` §6.

Constraint disposition:

- **Aria boundary:** adult email is processed in Aria's contracted Supabase project under a
  DPA. Child nickname, grade, class, transcript and memory remain only in Aria. No waiver.
- **Delete means delete:** child deletion has no identity-provider row to chase. Adult
  deletion revokes Aria sessions and device grants, removes Aria data, then calls hard
  `deleteUser`; valid-but-deleted JWTs are rejected by Aria's parent/session lookup. No
  waiver.
- **Parent visibility:** the parent owns the profile and can read, export, correct and delete
  all child data. A teacher relationship does not hide data from the parent. No waiver.
- **Non-reader start:** authorised device → picture profile → four-picture secret. No text
  or typing. No waiver.
- **Web and possible desktop:** the protocol is server-side. Web uses secure cookies; a
  desktop shell may store the same grant in the OS credential store. The desktop decision
  remains open. No waiver.

At 1,000 children the production identity list price is estimated at $25/month. At 100,000
children it remains $25/month under the stated 75,000-adult-MAU assumption; the conservative
105,000-adult case is $41.25/month. Email delivery is separate. These are August 2026 list
prices and must be rechecked before procurement.

Implementation is intentionally excluded here and specified in P0-28.
