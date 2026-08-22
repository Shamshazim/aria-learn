#!/usr/bin/env bash
#
# Agentic E2E explorer for Aria Learn.
#
#   Brain:  the `claude` CLI (your subscription — no API keys)
#   Hands:  the Playwright MCP server, registered user-scope by ./setup.sh
#
# The agent drives a real browser like a human tester, then writes a stability
# report to reports/. Run ./setup.sh once first. See README.md.
#
# Usage:
#   ./run-explorer.sh
#   BASE_URL=http://localhost:5173 ./run-explorer.sh
#
set -euo pipefail
cd "$(dirname "$0")"

# shellcheck disable=SC1091
source ./config.env

# --- preflight -------------------------------------------------------------
command -v claude        >/dev/null 2>&1 || { echo "❌ 'claude' CLI not found on PATH."; exit 1; }
command -v playwright-mcp >/dev/null 2>&1 || { echo "❌ Playwright MCP not installed. Run ./setup.sh first."; exit 1; }

if ! claude mcp list 2>&1 | grep -i playwright | grep -q "Connected"; then
  echo "❌ Playwright MCP server isn't connected. Run ./setup.sh"; exit 1
fi

echo "→ Checking the app is reachable at $BASE_URL ..."
curl -sf -o /dev/null "$BASE_URL" || { echo "❌ Can't reach $BASE_URL — is the frontend (npm run dev) running?"; exit 1; }
echo "  ✓ app is up"

echo "→ Verifying parent login works ..."
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/auth/login" \
  -X POST -H 'Content-Type: application/json' \
  -d "{\"usernameOrEmail\":\"$PARENT_LOGIN\",\"password\":\"$PARENT_PASSWORD\"}")
[ "$code" = "200" ] && echo "  ✓ login OK" || echo "  ⚠️  login returned HTTP $code (expected 200) — the agent may not get past login."

# --- build the prompt: mission + injected context --------------------------
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="reports/report-$STAMP.md"

PROMPT="$(cat mission.md)

---

## CONTEXT (injected at runtime — use these exact values)

- App base URL: $BASE_URL
- Parent login: $PARENT_LOGIN
- Parent password: $PARENT_PASSWORD
- Throwaway student username: $STUDENT_USERNAME
- Throwaway student password: $STUDENT_PASSWORD

Start by navigating to $BASE_URL."

echo "→ Launching the explorer agent (a visible browser will open; this takes a few minutes)…"
echo "  Report → $REPORT"
echo

# Scope the agent to ONLY the Playwright browser tools so a headless run never
# stalls on a permission prompt for anything else.
claude -p "$PROMPT" \
  --allowedTools "mcp__playwright" \
  --output-format text \
  | tee "$REPORT"

echo
echo "✅ Done. Report saved to $REPORT"
