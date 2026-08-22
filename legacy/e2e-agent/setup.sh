#!/usr/bin/env bash
#
# One-time setup for the Aria Learn e2e explorer.
#
# Why user-scope instead of a project .mcp.json: a project-level MCP server needs
# an interactive trust approval the first time, which can't happen in the headless
# `claude -p` run the explorer uses — it just sits "pending approval" forever.
# Servers added via `claude mcp add` are trusted automatically, so headless works.
#
# Safe to re-run (idempotent).
#
set -euo pipefail
cd "$(dirname "$0")"

TRACE_DIR="$(pwd)/reports/session"
mkdir -p "$TRACE_DIR"

echo "→ 1/3 Installing @playwright/mcp globally…"
npm install -g @playwright/mcp@latest >/dev/null 2>&1
echo "  ✓ $(playwright-mcp --version 2>/dev/null || echo installed)"

echo "→ 2/3 Installing the browser the MCP server drives…"
playwright-mcp install-browser chrome-for-testing >/dev/null 2>&1 \
  || npx --yes @playwright/mcp install-browser chrome-for-testing >/dev/null 2>&1
echo "  ✓ browser installed"

echo "→ 3/3 Registering the Playwright MCP server (user scope, auto-trusted)…"
claude mcp remove playwright >/dev/null 2>&1 || true
claude mcp add playwright --scope user -- \
  playwright-mcp --browser chromium --viewport-size 1280,900 \
  --save-session --output-dir "$TRACE_DIR" >/dev/null
echo "  ✓ registered"

echo
echo "→ Verifying the server connects…"
if claude mcp list 2>&1 | grep -i playwright | grep -q "Connected"; then
  echo "  ✓ playwright MCP server: Connected"
  echo
  echo "✅ Setup complete. Run the explorer with:  ./run-explorer.sh"
else
  echo "  ✘ Not connected. Check: claude mcp list"
  exit 1
fi
