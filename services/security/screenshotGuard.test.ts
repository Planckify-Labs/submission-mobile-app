/**
 * Source-level invariants for TWV-2026-023 — refcounted
 * `useScreenshotGuard`. Behavioural tests require a React renderer; we
 * therefore assert the shape via source grep and leave live refcount
 * semantics to the manual-regression list in
 * `docs/wallet-security-task/04_flag_secure_sensitive_screens_twv023_istaken_true_isfinish_true.md`.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/screenshotGuard.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const src = readFileSync(
  new URL("./screenshotGuard.ts", import.meta.url),
  "utf-8",
);

describe("screenshotGuard — refcount semantics (TWV-2026-023)", () => {
  it("exports useScreenshotGuard", () => {
    assert.match(src, /export function useScreenshotGuard/);
  });

  it("maintains a module-level activeCount, not a per-call flag", () => {
    assert.match(src, /let activeCount\s*=\s*0/);
  });

  it("increments activeCount on mount and decrements on cleanup", () => {
    assert.match(src, /activeCount\s*\+=\s*1/);
    assert.match(src, /activeCount\s*=\s*Math\.max\(0,\s*activeCount\s*-\s*1\)/);
  });

  it("engages capture prevention only when count transitions 0 → 1", () => {
    // `engage()` only calls preventScreenCaptureAsync when activeCount === 1.
    assert.match(
      src,
      /function engage[\s\S]*?activeCount\s*===\s*1[\s\S]*?preventScreenCaptureAsync/,
    );
  });

  it("releases only when count transitions back to 0", () => {
    assert.match(
      src,
      /function release[\s\S]*?activeCount\s*===\s*0[\s\S]*?allowScreenCaptureAsync/,
    );
  });

  it("iOS installs a screenshot listener while guard is active", () => {
    assert.match(src, /addScreenshotListener/);
  });
});
