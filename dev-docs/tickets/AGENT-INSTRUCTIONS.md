# Agent Instructions — how to pick up and finish a ticket

You are implementing one ticket from `dev-docs/tickets/`. Read this file, then
[`CODE-STANDARDS.md`](CODE-STANDARDS.md), then your ticket. Do not start before all three.

---

## 1. Before you write code

1. **Read the ticket end to end.** Every ticket is self-contained: it states the why, the
   scope, the file layout, the interfaces, the acceptance criteria and how to verify.
2. **Check its dependencies.** The header table names what must be merged first. If a
   dependency is not on `main`, stop and say so rather than stubbing it.
3. **Read the plan sections it references.** `master-plan.md` is the product authority;
   `cloud-model-layer.md` is the model-layer authority; `rewrite.md` says what we start from.
   When a ticket and a plan disagree, the plan wins — raise it, do not silently pick.
4. **Do not scaffold outside your ticket.** If your ticket needs a directory another ticket
   owns, that is a dependency, not an invitation.

## 2. Rules that apply to every ticket

- **TypeScript only, strict, no `any`.** See `CODE-STANDARDS.md` §1.
- **No source file over 300 lines.** Split by responsibility. See §2.
- **Separation of concerns is not negotiable.** Routers, controllers, services,
  repositories, schemas, types and mappers are separate files. UI logic and business logic
  are separate files. See §3.
- **`legacy/` is frozen.** Never edit, build, run, import from or execute anything under it.
  Reading it for reference is allowed where a ticket says so.
- **No secrets in the repo.** `.env` is gitignored; update `.env.example` instead.
- **Never push to `main`.** Branch as `feat/<ticket-id>-<slug>`, push, open a PR, hand it
  over. Do not merge your own PR. `main` requires an approving review from the repo owner.

## 3. Ticket anatomy

| Field | Meaning |
|---|---|
| **Phase** | Which `master-plan.md` §13 phase it belongs to. |
| **Track** | `Backend`, `Frontend`, `Shared`, `Infra`, `Content/QA`, or `Decision`. |
| **Depends on** | Must be merged before this starts. |
| **Blocks** | Tickets waiting on this one. |
| **Parallel-safe with** | Tickets that touch disjoint files and may run at the same time. |
| **Size** | S ≈ half a day, M ≈ 1–2 days, L ≈ 3–5 days, for one focused engineer or agent. |

Sections: **Why** (the product reason) → **Scope** (build / do not build) → **Design**
(file layout and interfaces, normative) → **Acceptance criteria** (checkboxes; all must pass)
→ **Verification** (the exact commands) → **References**.

The **Design** section is normative about *structure* — file names, layering, boundaries —
and indicative about *implementation detail*. Improve the implementation; do not quietly
collapse the structure.

## 4. Working in parallel

Tickets in the same phase with disjoint `Blocks`/`Depends on` chains are designed to run
concurrently. The rules that keep that safe:

- **Own your files.** Only create or edit files your ticket's Design section names. If you
  must touch a shared file (`app.ts`, the root `package.json`, a migration index), keep the
  change to the single line you need and say so in the PR.
- **Migrations are numbered by the ticket, not by wall-clock order.** Each ticket that adds
  a migration states its number. If two land out of order, they are still independent —
  never renumber a merged migration.
- **Never edit another ticket's files to make yours compile.** That is a missing dependency;
  report it.

## 5. Finishing

Run, at the repo root:

```bash
npm run typecheck && npm run lint && npm test
```

Then check the Definition of Done in `CODE-STANDARDS.md` §9, and open the PR with:

- The ticket id and title in the PR title.
- What you built, in three sentences.
- Anything you had to decide that the ticket did not settle.
- Anything you deliberately left out, and why.

## 6. When the ticket is wrong

It happens. Do not guess and do not silently expand scope. Say plainly what is wrong, what
you would do instead, and what it costs. Then either continue under a stated assumption
where it is safe to, or stop if proceeding either way would be wasted work.
