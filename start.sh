#!/usr/bin/env bash
# Host the DSi Web BIOS locally so you can test it in a browser.
#
#   ./start.sh          # serves on http://localhost:8080/
#   ./start.sh 9000     # serves on a port of your choice
#
# On WSL2 the app is reachable from your Windows browser at the same
# localhost URL. Press Ctrl+C to stop.

set -euo pipefail

# run from the repo root regardless of where the script is called from
cd "$(dirname "$0")"

PORT="${1:-8080}"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is not installed or not on PATH" >&2
  exit 1
fi

echo "Starting DSi Web BIOS on http://localhost:${PORT}/"
echo "(Ctrl+C to stop)"
exec node tools/host.mjs "$PORT"
