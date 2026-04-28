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

  it("maintains module-level prevent + alert refcounts, not per-call flags", () => {
    assert.match(src, /let preventCount\s*=\s*0/);
    assert.match(src, /let alertCount\s*=\s*0/);
  });

  it("increments preventCount on mount and decrements on cleanup", () => {
    assert.match(src, /preventCount\s*\+=\s*1/);
    assert.match(
      src,
      /preventCount\s*=\s*Math\.max\(0,\s*preventCount\s*-\s*1\)/,
    );
  });

  it("engages capture prevention only when count transitions 0 → 1", () => {
    assert.match(
      src,
      /function engagePrevent[\s\S]*?preventCount\s*===\s*1[\s\S]*?preventScreenCaptureAsync/,
    );
  });

  it("releases only when count transitions back to 0", () => {
    assert.match(
      src,
      /function releasePrevent[\s\S]*?preventCount\s*===\s*0[\s\S]*?allowScreenCaptureAsync/,
    );
  });

  it("iOS screenshot listener attaches only when alertCount transitions 0 → 1", () => {
    // The listener must be gated on `alertOnScreenshot` callers, not
    // every guarded screen — sign-message sheets engage prevention
    // without summoning the iOS popup.
    assert.match(
      src,
      /function engageAlert[\s\S]*?alertCount\s*===\s*1[\s\S]*?addScreenshotListener/,
    );
  });

  it("alert refcount only bumps when alertOnScreenshot option is set", () => {
    assert.match(src, /if \(alertOnScreenshot\) alertCount\s*\+=\s*1/);
    assert.match(src, /if \(alertOnScreenshot\) alertCount\s*=\s*Math\.max/);
  });
});
