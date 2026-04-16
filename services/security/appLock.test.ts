/**
 * TWV-2026-061 — recovery PIN (app password) storage invariants.
 *
 * We can't boot the full appLock module under node:test because it
 * imports `expo-sqlite` + `expo-local-authentication` + MMKV. Instead
 * we assert via source-level checks that:
 *   - `setPin` uses an iterated KDF (not plain SHA-256).
 *   - `verifyPin` uses a constant-time comparison.
 *   - A biometric-invalidation handler path exists and can fire.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/appLock.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const src = readFileSync(new URL("./appLock.ts", import.meta.url), "utf-8");

describe("appLock — PIN KDF strength (TWV-2026-061)", () => {
  it("uses an iteration constant, not a single SHA-256 pass", () => {
    assert.match(src, /PBKDF2_ITERATIONS_V2\s*=\s*[\d_]+/);
  });

  it("hashPin accepts an iterations parameter", () => {
    assert.match(src, /async function hashPin\([\s\S]*?iterations:\s*number/);
  });

  it("loops the hash the requested number of times", () => {
    assert.match(src, /for\s*\(let\s+i\s*=\s*0;\s*i\s*<\s*iterations/);
  });
});

describe("appLock — constant-time compare", () => {
  it("uses a diff-accumulator, not triple-equals, for the hash check", () => {
    assert.match(src, /constantTimeEquals\(hash,\s*storedHash\)/);
    assert.match(src, /diff\s*\|=\s*a\.charCodeAt/);
  });
});

describe("appLock — biometric invalidation hook", () => {
  it("exports onBiometricInvalidated + fireBiometricInvalidated", () => {
    assert.match(src, /export function onBiometricInvalidated/);
    assert.match(src, /export async function fireBiometricInvalidated/);
  });

  it("clears to `locked` state on invalidation", () => {
    assert.match(
      src,
      /fireBiometricInvalidated[\s\S]*?currentState\s*=\s*"locked"/,
    );
  });
});

describe("appLock — upgrade-on-verify path", () => {
  it("re-hashes legacy PINs on next successful verify", () => {
    assert.match(src, /version\s*<\s*HASH_VERSION_V2[\s\S]*?setPin\(pin\)/);
  });
});
