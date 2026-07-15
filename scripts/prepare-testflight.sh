#!/usr/bin/env bash
# YouTrader — Prepare TestFlight (Release Command Center entry point)
# Never pushes, merges, or deploys Production.
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/release-command-center/run.mjs testflight "$@"
