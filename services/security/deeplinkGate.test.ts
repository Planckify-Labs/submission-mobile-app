/**
 * Tests for the deeplink gate — TWV-2026-024.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/deeplinkGate.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inspectDeeplink } from "./deeplinkGate.ts";

describe("inspectDeeplink", () => {
  it("accepts a verified HTTPS deeplink and routes to preview", () => {
    const v = inspectDeeplink("https://takumipay.xyz/send?to=0x123");
    assert.equal(v.ok, true);
    if (v.ok) {
      assert.equal(v.preview, true);
      assert.match(v.route, /^\/send/);
    }
  });

  it("rejects an HTTPS deeplink to a different host", () => {
    const v = inspectDeeplink("https://phish.example/send");
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.code, "wrong_host");
  });

  it("flags sensitive routes opened via a custom scheme as preview-required", () => {
    const v = inspectDeeplink("takumiwallet://send?to=0x123");
    assert.equal(v.ok, true);
    if (v.ok && "reason" in v) {
      assert.match(v.reason ?? "", /preview required/i);
    }
  });

  it("rejects URLs whose fragment encodes seed material", () => {
    const v = inspectDeeplink(
      "https://takumipay.xyz/send?seed=abandon%20ability",
    );
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.code, "fragment_blocked");
  });

  it("rejects malformed URLs", () => {
    const v = inspectDeeplink("not-a-url");
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.code, "malformed");
  });
});
