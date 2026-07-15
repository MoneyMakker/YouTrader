#!/usr/bin/env bash
# YouTrader — Prepare Release X.Y.Z
# Usage: ./scripts/prepare-release.sh 1.6.0 [--dry-run] [--skip-build]
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="${1:?Usage: prepare-release.sh X.Y.Z}"
shift
exec node scripts/release-command-center/run.mjs release "$VERSION" "$@"
