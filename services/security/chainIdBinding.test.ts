/**
 * Tests for the chainId-binding guards — TWV-2026-029.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/chainIdBinding.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decideTxChainBinding,
  decideTypedDataChainBinding,
} from "./chainIdBinding.ts";

describe("decideTxChainBinding", () => {
  it("accepts an EIP-1559 (type-2) tx with matching chainId", () => {
    const d = decideTxChainBinding({ type: 2, chainId: 1 }, 1);
    assert.equal(d.ok, true);
  });

  it("rejects a tx missing chainId", () => {
    const d = decideTxChainBinding({ type: 2 }, 1);
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, "missing_chainid");
  });

  it("rejects a legacy (type-0) tx", () => {
    const d = decideTxChainBinding({ type: 0, chainId: 1 }, 1);
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, "legacy_type");
  });

  it("rejects a tx whose chainId disagrees with the active chain", () => {
    const d = decideTxChainBinding({ type: 2, chainId: 137 }, 1);
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, "domain_mismatch");
  });
});

describe("decideTypedDataChainBinding", () => {
  it("accepts typed data with matching domain.chainId (number)", () => {
    const d = decideTypedDataChainBinding({ domain: { chainId: 1 } }, 1);
    assert.equal(d.ok, true);
  });

  it("accepts typed data with matching domain.chainId (string)", () => {
    const d = decideTypedDataChainBinding({ domain: { chainId: "1" } }, 1);
    assert.equal(d.ok, true);
  });

  it("rejects typed data missing domain.chainId", () => {
    const d = decideTypedDataChainBinding({ domain: {} }, 1);
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, "missing_chainid");
  });

  it("rejects typed data whose domain.chainId disagrees with active chain", () => {
    const d = decideTypedDataChainBinding({ domain: { chainId: 5 } }, 1);
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, "domain_mismatch");
  });
});
