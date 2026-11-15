# P3-08-F2 — Timing flakes under full-suite load

|           |                        |
| --------- | ---------------------- |
| **Phase** | 3 (finding from P3-08) |
| **Track** | QA                     |
| **Size**  | S                      |

## Status

**Partly done, 2026-11-14,** on `fix/P3-08-F2-suite-timing-flakes`, pending review, stacked on
P3-08 (#48). Three real test-design hazards are fixed. The acceptance soak is **not yet
proven**, because the developer machine was swapping hard during it.

**What the investigation found.** Alone, every test named above runs well inside its limit.
Two concurrent full suites, used as artificial load, reproduced the mechanism: the ESLint-based
boundary tests climb from about 2 s to 4.6 s, against the `api` project's 5 s default. The auth
and parent-access tests stayed under 130 ms even under that load, read no wall clock, and use a
plain test hasher, not argon2, so their earlier failures are not explained by anything in them.

**Fixed:**

- **Provider stub timeouts.** The Anthropic harness and six OpenAI-compatible and Anthropic test
  files gave the stub endpoint `'timeout-seconds': 1`, so a busy machine could turn a passing
  localhost request into a timeout. They now use 10 s. The tests that check deadlines set their
  own `timeoutMs` and are unchanged. `openai-compatible.json-via.test.ts` has uncommitted local
  edits and was left alone; it still has 1 s.
- **Lint-boundary tests.** Each one built its own `ESLint`, and so a new TypeScript program per
  test. `testing/eslint-probe.ts` shares one instance per worker and warms it in `beforeAll`
  (30 s budget), so each test measures its rule, not start-up.
- **`api` project timeouts.** These are now 30 s per test and 60 s per hook, the same as
  `api-db`. A timeout here catches a hang, not slowness: the 10,000-item property sweeps take
  under a second alone and crossed 5 s under load. Nothing retries.

**Soaks.** Before the timeout change, 17 of 20 consecutive full runs were clean. The three that
weren't failed at CPU-heavy tests, by timeout, plus the new warm-up hook at its first 10 s
budget. After it, 4 of the 6 runs that finished within the job's time limit were clean. The two
failing runs took 16 and 30 minutes against roughly 90 s normally. In those runs, database tests
timed out mid-transaction and left a deadlock and a duplicate key for the next test. At the time
the machine had 7.3 of 8 GB of swap in use and over a million pageouts. A 10–20× slowdown from
swapping defeats any timeout, and no change in the tests can fix that.

**Remaining:**

- Re-run the 20-run soak on CI or a freshly restarted machine. That is the acceptance this
  ticket still owes.
- A database test that times out leaves its transaction behind for the next test. Making each
  `api-db` file reset fully on a failed test would stop one timeout cascading into several. That
  is worth its own small ticket if CI shows it.

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
