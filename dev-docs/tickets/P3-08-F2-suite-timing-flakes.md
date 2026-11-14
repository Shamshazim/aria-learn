# P3-08-F2 — Timing flakes under full-suite load

|           |                        |
| --------- | ---------------------- |
| **Phase** | 3 (finding from P3-08) |
| **Track** | QA                     |
| **Size**  | S                      |

## Why

While P3-07 and P3-08 were built, three full `npm test` runs each failed a handful of tests
that pass alone and on the next run: `routes/auth.routes.test.ts` (PIN lockout),
`routes/parent-access.routes.test.ts`, `ai/provider/adapters/anthropic.test.ts` and
`quality/wordlists/wordlist-import-lint.test.ts`. Each does slow work — PIN hashing, a lint
run — inside a default timeout, and under the full suite's load the work sometimes overruns.
A gate that fails one run in three teaches people to re-run it, which is the habit a gate
exists to break.

## Scope

Find each test's slow step; give it an explicit, measured timeout or move the slow work into
`beforeAll`; or, for PIN hashing, use the test cost parameter the hasher already takes. No
retries: a retry hides a real failure as well as a flake.

## Acceptance

- Twenty consecutive full-suite runs on a developer machine with no failure outside the
  known catalogue tests.
