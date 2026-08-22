# Aria Learn — Claude Code Context

## Project overview

An AI tutor for children, TK through grade 8. The project is in a **rewrite**.

## The rewrite rule

`legacy/` holds the first version: Java 21 / Spring Boot backend, Vite frontend,
Electron desktop shell with a bundled Ollama. It is **frozen**.

- Never edit, build, run or test anything under `legacy/`.
- Never import from it or call into it at runtime.
- Read it for reference, then reimplement. See `legacy/LEGACY.md` for what is
  worth reading and why.

**One exception.** `legacy/frontend/src/session/` is already React + TypeScript
and is the student session UI: the class picker plus three band layouts. It gets
**copied once** into the new frontend when the tree is scaffolded, then owned
there. That is a copy at scaffold time, not an import. Four of its files reach
outside the folder and each needs rewriting on the way in;
`dev-docs/rewrite.md` §2 names them. `sources/replies.ts` is deliberately left
behind.

## Target stack

- Frontend: React + TypeScript + Vite
- Backend: Node + Express + TypeScript
- Database: PostgreSQL
- Models: hosted only. No Ollama, no local weights, no offline mode.

The new tree does not exist yet. Ask before scaffolding a directory layout.

## The plans are the spec

- `dev-docs/rewrite.md` — **read first.** What carries forward from `legacy/`,
  what gets rebuilt, the proposed repo layout, and the order of work.
- `dev-docs/master-plan.md` — the product.
- `dev-docs/cloud-model-layer.md` — the model layer, cloud-only.

The last two were written against the old code base. The *decisions* in them
hold; the Java class names in them are targets to reimplement in TypeScript, and
every "delete this" instruction now reads as "never write it".

## Git

- Main branch: `main`. Remote: `origin` (GitHub).
- **Never push directly to `main` — always branch, push, and open a PR.** `main`
  requires a pull request with one approving review. Admin pushes are not
  blocked (`enforce_admins` is off), so a direct push succeeds and merely
  reports "Bypassed rule violations". Treat that message as a mistake to undo.
- PRs need an approval from the repo owner. Hand the PR over; do not merge it.
- No API keys or secrets in the repository. `.env` is gitignored.
