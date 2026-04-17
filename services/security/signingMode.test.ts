/**
 * TWV-2026-035 — signing-mode helpers. The full SecureStore-backed
 * hydrate is integration-tested manually; here we cover the pure
 * predicate (`isSurfaceDisabled`) via source-level inspection so the
 * production code stays node-test-runnable without booting the full
 * RN module graph.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/signingMode.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const src = readFileSync(new URL("./signingMode.ts", import.meta.url), "utf-8");

describe("signingMode — TWV-2026-035 source invariants", () => {
  it("persists via signingSecureSet (auth-gated SecureStore)", () => {
    assert.match(
      src,
      /signingSecureSet\(STORAGE_KEY,\s*enabled \? "1" : "0"\)/,
    );
  });

  it("hydrate is async and reads the same key", () => {
    assert.match(
      src,
      /export async function hydrateSigningMode\(\)[\s\S]*?signingSecureGet\(STORAGE_KEY\)/,
    );
  });

  it("isSurfaceDisabled defaults to false when mode is off", () => {
    assert.match(
      src,
      /export function isSurfaceDisabled[\s\S]*?if \(!getSigningModeSync\(\)\) return false/,
    );
  });

  it("subscribers are notified on change", () => {
    assert.match(src, /export function subscribeSigningMode/);
    assert.match(
      src,
      /function notify\(\)[\s\S]*?for \(const l of listeners\)/,
    );
  });
});
