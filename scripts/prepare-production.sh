#!/usr/bin/env bash
# YouTrader — Prepare Production (requires QA sign-offs)
# Never submits App Store or pushes git automatically.
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/release-command-center/run.mjs production "$@"
