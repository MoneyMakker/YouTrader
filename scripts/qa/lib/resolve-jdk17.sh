#!/usr/bin/env bash
# Resolve OpenJDK 17 for YouTrader QA (Maestro). Prefer java_home -v 17, then Homebrew.
# Source this file; sets JAVA_HOME and prepends bin to PATH. Does not edit shell profiles.
# Exit 2 if Java 17 cannot be resolved or a non-17 runtime would be selected.

resolve_jdk17() {
  local home="" cand pfx

  home="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
  if [[ -z "$home" || ! -x "$home/bin/java" ]]; then
    pfx="$(brew --prefix openjdk@17 2>/dev/null || true)"
    for cand in \
      "${pfx:+$pfx/libexec/openjdk.jdk/Contents/Home}" \
      "${pfx}" \
      "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" \
      "$HOME/.youtrader-qa-tools/jdk-17/Contents/Home" \
      "$HOME/.youtrader-qa-tools/jdk-17"
    do
      [[ -z "${cand:-}" ]] && continue
      if [[ -x "$cand/bin/java" ]]; then
        home="$cand"
        break
      fi
    done
  fi

  if [[ -z "$home" || ! -x "$home/bin/java" ]]; then
    echo "error: OpenJDK 17 not found (java_home -v 17 / brew openjdk@17)" >&2
    return 2
  fi

  # Reject accidental Java 26+ selection
  local ver
  ver="$("$home/bin/java" -version 2>&1 | head -1 || true)"
  if ! echo "$ver" | rg -q 'version "17\.'; then
    echo "error: resolved JDK is not 17: $ver (home=$home)" >&2
    return 2
  fi

  export JAVA_HOME="$home"
  export PATH="$JAVA_HOME/bin:${PATH:-}"
  echo "$JAVA_HOME"
  return 0
}

# When executed directly, print JAVA_HOME
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  set -euo pipefail
  resolve_jdk17
  java -version
fi
