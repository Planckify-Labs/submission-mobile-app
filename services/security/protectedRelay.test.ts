/**
 * Tests for the protected-relay router — TWV-2026-050.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/protectedRelay.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isProtectableChain, pickProtectedRelay } from "./protectedRelay.ts";

describe("pickProtectedRelay", () => {
  it("routes a Uniswap V2 swap on mainnet to a relay", () => {
    const r = pickProtectedRelay(
      1,
      "0x38ed1739000000000000000000000000abc" as `0x${string}`,
    );
    assert.ok(r);
    assert.match(r.url, /flashbots|mevblocker|beaver/i);
  });

  it("routes a Uniswap Universal Router execute on mainnet", () => {
    const r = pickProtectedRelay(1, "0x3593564cdeadbeef" as `0x${string}`);
    assert.ok(r);
  });

  it("does NOT route a plain ERC-20 transfer", () => {
    const r = pickProtectedRelay(
      1,
      "0xa9059cbb000000000000000000000000abc" as `0x${string}`,
    );
    assert.equal(r, null);
  });

  it("does NOT route on a chain without a configured relay", () => {
    const r = pickProtectedRelay(137, "0x38ed1739deadbeef" as `0x${string}`);
    assert.equal(r, null);
  });

  it("respects the user's opt-out", () => {
    const r = pickProtectedRelay(1, "0x38ed1739deadbeef" as `0x${string}`, {
      userOptedOut: true,
    });
    assert.equal(r, null);
  });

  it("returns null for empty / short calldata", () => {
    assert.equal(pickProtectedRelay(1, undefined), null);
    assert.equal(pickProtectedRelay(1, "0xabc" as `0x${string}`), null);
  });
});

describe("isProtectableChain", () => {
  it("true for mainnet", () => {
    assert.equal(isProtectableChain(1), true);
  });
  it("false for an unconfigured chain", () => {
    assert.equal(isProtectableChain(99999), false);
  });
});
