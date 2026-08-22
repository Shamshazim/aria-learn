# P0-01 — Workspace scaffold

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Infra |
| **Depends on** | — |
| **Blocks** | P0-02, P0-03, P0-05, P0-16 |
| **Parallel-safe with** | P0-26 |
| **Size** | M |

## Why

The new tree does not exist. Every other ticket assumes a workspace with strict TypeScript,
shared lint rules, one test runner and one command that checks the whole repo. Getting this
wrong once costs every ticket after it.

## Scope

### Build
- An npm workspace at the repo root with `apps/web`, `apps/api`, `packages/shared`.
- Root TypeScript config with the strict flag set from `CODE-STANDARDS.md` §1, extended by
  each package.
- ESLint (flat config) + Prettier, shared at the root, with the rules that enforce our
  standards: `no-explicit-any`, `import/no-cycle`, `max-lines: 300`, `max-params`,
  import-order, and a boundary rule that forbids importing `legacy/**` from anywhere.
- Vitest at the root, projects wired for `api` and `shared`; `apps/web` adds its own
  jsdom environment.
- `.env.example`, `.gitignore` entries, `.nvmrc` (Node 22 LTS), `engines` in the root
  `package.json`.
- Root scripts: `dev`, `build`, `typecheck`, `lint`, `lint:fix`, `test`, `test:watch`,
  `check` (typecheck + lint + test).
- A CI workflow (`.github/workflows/ci.yml`) running `npm ci && npm run check` on PRs.
- `README.md` in the repo root updated with how to run the workspace.

### Do not build
- No application code. No Express app, no React app beyond what the generators emit and
  what §Design names. Those are P0-03 and P0-05.
- No Docker, no deploy pipeline. Not this phase.

## Design

```
package.json            workspaces: ["apps/*", "packages/*"]; only scripts + devDeps
tsconfig.base.json      strict flags, path aliases, no emit
eslint.config.js        flat config, shared rules, per-package overrides
.prettierrc
vitest.workspace.ts
.env.example
.nvmrc
apps/api/package.json        name: @aria/api
apps/api/tsconfig.json       extends ../../tsconfig.base.json
apps/web/package.json        name: @aria/web
apps/web/tsconfig.json
packages/shared/package.json name: @aria/shared
packages/shared/tsconfig.json
```

Path aliases: `@aria/shared` resolves to `packages/shared/src`; inside each app, `@/*`
resolves to that app's `src/*`. No relative import ever leaves its own package.

The `max-lines` ESLint rule is set to `["error", { max: 300, skipBlankLines: false,
skipComments: false }]`. It is an error, not a warning — the 300-line rule is enforced by the
tool, not by reviewers.

The legacy boundary is a lint rule, so a future agent physically cannot import from
`legacy/`:

```js
// eslint.config.js
'no-restricted-imports': ['error', { patterns: ['**/legacy/**', '../../legacy/*'] }]
```

## Acceptance criteria

- [ ] `npm ci` at the root installs all three packages.
- [ ] `npm run check` passes on a clean tree.
- [ ] A file with `const x: any = 1` fails lint.
- [ ] A 301-line source file fails lint.
- [ ] An import from `legacy/` fails lint.
- [ ] A circular import between two new files fails lint.
- [ ] `.env` is gitignored and `.env.example` is committed with no real values.
- [ ] CI runs `npm run check` on every PR and is required for merge.

## Verification

```bash
npm ci
npm run check
# then, in a scratch file, prove each guard fails as expected, and delete it
```

## References

- `rewrite.md` §4 (repo layout), §5 step 1
- `CODE-STANDARDS.md` §1, §2, §7
