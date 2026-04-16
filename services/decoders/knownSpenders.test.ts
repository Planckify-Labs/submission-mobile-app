/**
 * TWV-2026-008 — known-safe spender allowlist coverage.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/decoders/knownSpenders.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isKnownSpender } from "./knownSpenders.ts";

describe("isKnownSpender", () => {
  it("recognises Permit2 on mainnet", () => {
    const hit = isKnownSpender("0x000000000022D473030F116dDEE9F6B43aC78BA3", 1);
    assert.ok(hit);
    assert.equal(hit?.name, "Permit2");
  });

  it("is case-insensitive", () => {
    const hit = isKnownSpender("0x000000000022d473030f116ddee9f6b43ac78ba3", 1);
    assert.ok(hit);
  });

  it("rejects the Permit2 address on an unlisted chain", () => {
    // Permit2 is listed on 1/10/137/8453/42161. Chain 99999 should not match.
    const hit = isKnownSpender(
      "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      99999,
    );
    assert.equal(hit, null);
  });

  it("falls back to address-only when chainId is unknown", () => {
    const hit = isKnownSpender("0x000000000022D473030F116dDEE9F6B43aC78BA3");
    assert.ok(hit);
  });

  it("returns null for a random address", () => {
    const hit = isKnownSpender("0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
    assert.equal(hit, null);
  });

  it("returns null for Uniswap router used on a different chain", () => {
    // Mainnet Universal Router on Base is a different deployment.
    const hit = isKnownSpender(
      "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
      8453,
    );
    assert.equal(hit, null);
  });
});
