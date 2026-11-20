#!/usr/bin/env bash
# Install dependencies at the start of cloud (remote) sessions.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR"
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund
elif [ -f package.json ]; then npm install --no-audit --no-fund
fi
if [ -f playwright.config.ts ]; then npx playwright install --with-deps chromium webkit >/dev/null 2>&1 || true; fi
