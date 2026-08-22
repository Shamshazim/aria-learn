# Aria Learn — Agentic E2E Explorer

An AI agent that logs into Aria Learn and does a hands-on, **human-like**
end-to-end check, then reports whether your flows are stable — in plain English.

It is **not** a scripted Playwright suite. There are no hardcoded selectors or
step lists. The agent looks at each page (via the accessibility tree), reasons
about what a human tester would do next, acts, and adapts — so it keeps working
when you rename a class, and it notices things you never wrote a test for.

## How it works

```
  claude CLI  ──►  reasons: "what would a human do next?"
   (the brain,        │
    your sub)         ▼
  Playwright MCP ──►  drives a real Chromium browser at http://localhost:5173
   (the hands)        │   navigate · snapshot · click · type · read console
                      ▼
              writes reports/report-<timestamp>.md
```

- **Brain:** the `claude` CLI — uses your Claude subscription, no API keys.
- **Hands/eyes:** [`@playwright/mcp`](https://github.com/microsoft/playwright-mcp),
  wired in via `.mcp.json`. It feeds Claude the page's accessibility tree, so the
  agent targets elements by role + visible label, like a person.

## One-time setup

```bash
# make sure the app is running:
#   backend:  cd backend && ./mvnw spring-boot:run   (:8080)
#   frontend: cd frontend && npm run dev             (:5173)

cd e2e-agent
chmod +x setup.sh run-explorer.sh
./setup.sh   # installs @playwright/mcp globally, its browser, and registers
             # the MCP server at user scope (auto-trusted so headless works)
```

Why user-scope and not a project `.mcp.json`: a project MCP server needs an
interactive trust approval the first time, which can't happen in the headless
`claude -p` run this uses — it just sits "pending approval". `claude mcp add`
(what `setup.sh` does) registers it trusted, so the headless run works.

## Run it

```bash
cd e2e-agent
./run-explorer.sh
```

A visible browser opens and you watch it work. To run windowless instead,
re-register with `--headless`:
`claude mcp remove playwright && claude mcp add playwright --scope user -- playwright-mcp --headless --browser chromium --save-session --output-dir "$PWD/reports/session"`

The agent will:
1. Sign in as the demo parent (`parent@demo.com`).
2. Explore the parent experience (dashboard, students, insights, curriculum…).
3. Try to create/log in as a throwaway student and walk a topic's learning flow
   (knowledge → examples → guided → practice → quiz), actually answering a couple
   of questions.
4. Write a **Stability Report** with a verdict (STABLE ✅ / MINOR ISSUES ⚠️ /
   BROKEN ❌), per-journey results, and specific findings.

The report streams to your terminal and is saved to `reports/`. A Playwright
trace is saved to `reports/trace/` — inspect it with
`npx playwright show-trace reports/trace/<file>`.

## Files

| File | What it is |
|------|-----------|
| `mission.md` | The human-tester brief — the agent's persona, goals, guardrails, and required report format. **Edit this to change what/how it tests.** |
| `config.env` | Base URL + demo credentials (local dev only — no real secrets). |
| `setup.sh` | One-time: installs Playwright MCP + its browser, registers the server (user scope). |
| `run-explorer.sh` | Preflight checks (app up? login works? MCP connected?) → launches the agent → saves the report. |
| `reports/` | Timestamped reports + Playwright traces. |

## Tuning

- **Test different things:** edit `mission.md` — it's just instructions in English.
- **Point at staging/prod:** `BASE_URL=https://... ./run-explorer.sh` (and update
  credentials in `config.env`).
- **The agent gets stuck / too cautious:** loosen the guardrails in `mission.md`,
  or add more specific journey steps.

## What this is (and isn't)

- ✅ Great for **exploratory** stability checks and catching the unexpected.
- ⚠️ It's **non-deterministic** — two runs may take different paths. That's a
  feature for exploration, but it means it's not a strict pass/fail CI gate.
- 👉 For a deterministic red/green regression gate on the critical path, pair this
  with a small scripted smoke test (planned as the next piece — `smoke.mjs`).
```
