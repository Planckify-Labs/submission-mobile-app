#!/usr/bin/env bash
# eas-build-cleanup.sh
#
# Reclaims memory after `eas build --local --platform android`. The local
# build leaves the Gradle daemon (a JVM with a multi-GB heap), the Kotlin
# compile daemon, and a Metro/Node worker pool resident — running a second
# build on top of the first is what causes the laptop freeze on machines
# without much swap.
#
# This script stops the Gradle daemon cleanly when possible, then kills any
# leftover JVM/Node processes spawned by EAS, and clears the temp build
# directory EAS creates under TMPDIR. Safe to run any time; it only targets
# build-related processes.

set -u

say() { printf '  %s\n' "$*"; }

echo "==> EAS local Android build cleanup"

# 1. Ask Gradle daemons to shut down gracefully (frees the JVM heap).
if command -v gradle >/dev/null 2>&1; then
  say "gradle --stop"
  gradle --stop >/dev/null 2>&1 || true
fi

# 2. Kill any leftover Gradle / Kotlin / Java daemons by name. EAS spawns
#    these inside a temp dir that no longer exists after the build, so
#    `gradle --stop` above can't always reach them.
for pattern in \
  "GradleDaemon" \
  "GradleWrapperMain" \
  "KotlinCompileDaemon" \
  "org.gradle.launcher.daemon"; do
  if pgrep -f "$pattern" >/dev/null 2>&1; then
    say "killing: $pattern"
    pkill -f "$pattern" 2>/dev/null || true
  fi
done

# 3. Kill stray EAS / Metro / Expo Node workers. Match on the EAS local
#    build path so we don't touch an unrelated `expo start` you might have
#    running in another terminal.
for pattern in \
  "eas-cli-local-build-plugin" \
  "eas-build-local" \
  "@expo/cli.*export" \
  "metro.*eas-build"; do
  if pgrep -f "$pattern" >/dev/null 2>&1; then
    say "killing: $pattern"
    pkill -f "$pattern" 2>/dev/null || true
  fi
done

# 4. Remove EAS local build scratch dirs. Each run gets its own
#    `~/.cache/eas-build-tmp/<hash>/` containing a copy of the source plus
#    an installed node_modules — EAS creates a fresh one every build, so
#    these are safe to delete. The pnpm package store (~/.local/share/pnpm)
#    and Gradle cache (~/.gradle/caches) are untouched, so the next build
#    does not re-download anything.
TMP="${TMPDIR:-/tmp}"
shopt -s nullglob
for dir in "$HOME"/.cache/eas-build-tmp/* "$TMP"/eas-build-local-*; do
  if [ -d "$dir" ]; then
    say "rm: $dir"
    rm -rf "$dir" 2>/dev/null || true
  fi
done
shopt -u nullglob

# 5. Report memory so it's obvious whether the cleanup actually freed RAM.
if command -v free >/dev/null 2>&1; then
  echo
  free -h
fi

echo "==> done"
