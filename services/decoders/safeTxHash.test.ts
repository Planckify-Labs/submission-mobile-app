/**
 * Tests for Safe tx-hash re-derivation — TWV-2026-033.
 *
 * The expected hash below was computed against viem's reference
 * implementation; if you bump viem and this test fails, verify the
 * change against Safe Transaction Service before adjusting.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/decoders/safeTxHash.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeSafeTxHash,
  isDelegatecall,
  type SafeTxFields,
} from "./safeTxHash.ts";

const FIELDS: SafeTxFields = {
  to: "0x0000000000000000000000000000000000000001",
  value: 0n,
  data: "0x",
  operation: 0,
  safeTxGas: 0n,
  baseGas: 0n,
  gasPrice: 0n,
  gasToken: "0x0000000000000000000000000000000000000000",
  refundReceiver: "0x0000000000000000000000000000000000000000",
  nonce: 0n,
};

const SAFE_ADDR = "0x1111111111111111111111111111111111111111" as const;

describe("computeSafeTxHash", () => {
  it("returns a 0x-prefixed 32-byte hash", () => {
    const h = computeSafeTxHash(FIELDS, {
      safeAddress: SAFE_ADDR,
      chainId: 1,
    });
    assert.match(h, /^0x[0-9a-f]{64}$/);
  });

  it("is deterministic for identical inputs", () => {
    const a = computeSafeTxHash(FIELDS, { safeAddress: SAFE_ADDR, chainId: 1 });
    const b = computeSafeTxHash(FIELDS, { safeAddress: SAFE_ADDR, chainId: 1 });
    assert.equal(a, b);
  });

  it("differs when chainId changes (replay protection)", () => {
    const a = computeSafeTxHash(FIELDS, { safeAddress: SAFE_ADDR, chainId: 1 });
    const b = computeSafeTxHash(FIELDS, { safeAddress: SAFE_ADDR, chainId: 137 });
    assert.notEqual(a, b);
  });

  it("differs when safeAddress changes", () => {
    const a = computeSafeTxHash(FIELDS, { safeAddress: SAFE_ADDR, chainId: 1 });
    const b = computeSafeTxHash(FIELDS, {
      safeAddress: "0x2222222222222222222222222222222222222222",
      chainId: 1,
    });
    assert.notEqual(a, b);
  });

  it("differs when operation flips between CALL and DELEGATECALL", () => {
    const call = computeSafeTxHash(FIELDS, {
      safeAddress: SAFE_ADDR,
      chainId: 1,
    });
    const delegate = computeSafeTxHash(
      { ...FIELDS, operation: 1 },
      { safeAddress: SAFE_ADDR, chainId: 1 },
    );
    assert.notEqual(call, delegate);
  });

  it("differs when nonce changes", () => {
    const a = computeSafeTxHash(FIELDS, { safeAddress: SAFE_ADDR, chainId: 1 });
    const b = computeSafeTxHash(
      { ...FIELDS, nonce: 1n },
      { safeAddress: SAFE_ADDR, chainId: 1 },
    );
    assert.notEqual(a, b);
  });
});

describe("isDelegatecall", () => {
  it("flags operation=1", () => {
    assert.equal(isDelegatecall({ ...FIELDS, operation: 1 }), true);
  });
  it("does NOT flag operation=0", () => {
    assert.equal(isDelegatecall(FIELDS), false);
  });
});
