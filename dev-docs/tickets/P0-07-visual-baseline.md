# P0-07 — Capture the visual baseline

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Frontend / QA |
| **Depends on** | P0-06 |
| **Blocks** | P0-09 |
| **Parallel-safe with** | P0-10 … P0-17 |
| **Size** | S |

## Why

P0-08 and P0-09 rewrite everything underneath these screens. Without a recorded baseline,
"we preserved the design" is a claim nobody can check. `rewrite.md` §2 makes capturing it
step 1 of bringing the UI forward for exactly this reason.

## Scope

### Build
A Playwright visual and accessibility baseline for the class picker and all three band
layouts, checked in, runnable in CI, with an explicit approval step for intended changes.

### Do not build
No pixel-perfect regression gate on every element. This is a reviewable baseline, not a
straitjacket — later tickets *will* change these screens deliberately.

## Design

```
apps/web/e2e/
  baseline/
    session-visual.spec.ts    picker + 3 bands, 2 viewports each
    session-a11y.spec.ts      axe on each screen
  fixtures/
    scripted-session.ts       the deterministic session used for every screenshot
  snapshots/                  committed PNGs
playwright.config.ts
```

- Screenshots are taken against the **scripted** session, with animations disabled, fonts
  preloaded, and a fixed viewport — so a diff means a real change, not a timing artefact.
- Two viewports: a tablet (the primary device for a young child) and a laptop.
- Each band captures at least: the first question, a wrong answer with a hint, and the end
  card.
- A diff fails CI. Updating a snapshot is a deliberate, reviewed commit with a one-line
  reason in the PR.

## Acceptance criteria

- [ ] `npm run e2e:baseline` produces or verifies snapshots for the picker and all three
      bands at both viewports.
- [ ] Axe passes with zero violations on all four screens.
- [ ] The suite is deterministic: ten consecutive runs on the same commit produce no diff.
- [ ] CI runs it on every PR that touches `apps/web`.
- [ ] `apps/web/e2e/README.md` explains in five lines how to approve an intended change.

## Verification

```bash
npx playwright install --with-deps
npm run e2e:baseline
npm run e2e:baseline   # twice; the second run must be clean
```

## References

- `rewrite.md` §2 ("How to bring it forward", step 1)
