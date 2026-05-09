#!/usr/bin/env bash
# Run all test files that use Node's built-in test runner (`node:test`).
# Uses the resolver hook at services/walletKit/evm/_test-resolver.mjs to
# stub RN-only modules (expo-secure-store, @/lib/storage/mmkv) and rewrite
# `@/*` aliases + extensionless TS imports — that gives the wallet/walletKit
# tests enough harness to run under plain Node.
set -euo pipefail

cd "$(dirname "$0")/.."

mapfile -t FILES < <(
  grep -rl --include="*.test.ts" --include="*.test.tsx" \
    -E 'from "node:test"|require\("node:test"\)' \
    --exclude-dir=node_modules .
)

echo "Running ${#FILES[@]} node:test files..."
node --test --experimental-strip-types \
  --import ./services/walletKit/evm/_test-resolver.mjs \
  --test-reporter=spec "${FILES[@]}"
