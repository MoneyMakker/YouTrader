#!/usr/bin/env bash
# Shared Xcode env loader for YouTrader.
# Sources base .xcode.env(+.local), then staging overlay when CONFIGURATION contains Staging.
# Safe for Expo Constants generation, Bundle RN, and Metro-adjacent tooling.

set -euo pipefail

_YT_IOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

if [[ -f "${_YT_IOS_DIR}/.xcode.env" ]]; then
  # shellcheck disable=SC1091
  source "${_YT_IOS_DIR}/.xcode.env"
fi
if [[ -f "${_YT_IOS_DIR}/.xcode.env.local" ]]; then
  # shellcheck disable=SC1091
  source "${_YT_IOS_DIR}/.xcode.env.local"
fi

if [[ "${CONFIGURATION:-}" == *Staging* ]]; then
  if [[ -f "${_YT_IOS_DIR}/.xcode.env.staging" ]]; then
    # shellcheck disable=SC1091
    source "${_YT_IOS_DIR}/.xcode.env.staging"
    echo "note: sourced ios/.xcode.env.staging for CONFIGURATION=${CONFIGURATION}"
  else
    echo "error: ios/.xcode.env.staging required for Staging configuration ${CONFIGURATION}" >&2
    exit 1
  fi
fi
