/**
 * Tests for the IDN-homograph detector — TWV-2026-052.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/idnHomograph.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inspectUrl } from "./idnHomograph.ts";

describe("inspectUrl", () => {
  it("returns ok for an all-ASCII host", () => {
    const v = inspectUrl("https://uniswap.org/swap");
    assert.equal(v.warning, "ok");
    assert.equal(v.display, "uniswap.org");
  });

  it("flags Cyrillic-Latin homograph (uniswap with Cyrillic 'а')", () => {
    // First letter is U+0430 Cyrillic small a, then Latin 'niswap.org'.
    const v = inspectUrl("https://\u0430niswap.org/");
    assert.equal(v.warning, "confusable");
    // ASCII form must be the punycode fallback.
    assert.match(v.ascii, /xn--/);
  });

  it("flags multi-script (Greek + Cyrillic)", () => {
    // Greek alpha + Cyrillic ka — both non-Latin.
    const v = inspectUrl("https://\u03b1\u043a-test.example/");
    assert.equal(v.warning, "multi-script");
  });

  it("returns ok for a single-script non-Latin domain (Han)", () => {
    // Pure Han (Chinese) host — legitimate IDN, not confusable.
    const v = inspectUrl("https://\u4f8b.\u6e2c\u8a66/");
    assert.equal(v.warning, "ok");
  });

  it("returns ok input as-is on parse failure", () => {
    const v = inspectUrl("not-a-url");
    assert.equal(v.warning, "ok");
    assert.equal(v.display, "not-a-url");
  });
});
