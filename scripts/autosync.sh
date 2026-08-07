#!/bin/bash
# Diet dashboard sync — runs every 30 min. Silent unless something changed.
# Pipeline (BK only, user 1):
#   1. pull:  D1 → wiki   (BK dashboard edits flow back to the wiki)
#   2. sync:  wiki → JSON (public/diet-data.json)
#   3. push:  JSON → D1   (wiki/Telegram logs flow to D1)
# Other users are D1-only and unaffected.
set -euo pipefail

cd "$HOME/projects/calorie-dashboard"

set -a
# shellcheck disable=SC1091
source "$HOME/projects/calorie-dashboard/.env"
set +a

PULL_OUT=$(node scripts/pull.mjs 2>&1)
SYNC_OUT=$(node scripts/sync.mjs 2>&1)

if echo "$PULL_OUT" | grep -q "↻" || ! echo "$SYNC_OUT" | grep -q "No change"; then
  PUSH_OUT=$(node scripts/push.mjs 2>&1) || {
    echo "❌ D1 push failed:"
    echo "$PUSH_OUT"
    exit 1
  }
  echo "✅ 飲食 Dashboard 已同步 (wiki ↔ D1)"
  echo "$PULL_OUT" | grep "↻" || true
  echo "$SYNC_OUT"
  echo "$PUSH_OUT"
fi
