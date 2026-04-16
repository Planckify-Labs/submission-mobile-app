/**
 * Tests for the bundle-integrity decision — TWV-2026-056.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/bundleIntegrity.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decideBundleIntegrity } from "./bundleIntegrity.ts";

const VALID = "a".repeat(64);
const OTHER = "b".repeat(64);

describe("decideBundleIntegrity", () => {
  it("accepts identical hashes", () => {
    const d = decideBundleIntegrity({
      runtimeSha256: VALID,
      manifestSha256: VALID,
    });
    assert.equal(d.ok, true);
  });

  it("rejects mismatch", () => {
    const d = decideBundleIntegrity({
      runtimeSha256: VALID,
      manifestSha256: OTHER,
    });
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, "mismatch");
  });

  it("rejects missing manifest hash", () => {
    const d = decideBundleIntegrity({
      runtimeSha256: VALID,
      manifestSha256: null,
    });
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, "missing_manifest");
  });

  it("rejects missing runtime hash", () => {
    const d = decideBundleIntegrity({
      runtimeSha256: null,
      manifestSha256: VALID,
    });
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, "missing_runtime");
  });

  it("rejects malformed hashes (not 64 hex chars)", () => {
    const d = decideBundleIntegrity({
      runtimeSha256: "not-a-hash",
      manifestSha256: VALID,
    });
    assert.equal(d.ok, false);
  });

  it("normalises 0x-prefix and case", () => {
    const d = decideBundleIntegrity({
      runtimeSha256: "0x" + VALID.toUpperCase(),
      manifestSha256: VALID,
    });
    assert.equal(d.ok, true);
  });
});
