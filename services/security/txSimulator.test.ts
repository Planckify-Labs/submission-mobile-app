/**
 * Tests for the pre-sign asset-delta predictor — TWV-2026-011.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/txSimulator.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeFunctionData, parseAbiItem } from "viem";

import { predictAssetDeltasFromCalldata } from "./txSimulator.ts";

const FROM = "0x000000000000000000000000000000000000aaaa" as const;
const TOKEN = "0x000000000000000000000000000000000000bbbb" as const;
const TO = "0x000000000000000000000000000000000000cccc" as const;
const SPENDER = "0x000000000000000000000000000000000000dddd" as const;

describe("predictAssetDeltasFromCalldata", () => {
  it("emits a native-out delta for a plain ETH send", () => {
    const { deltas, coverage } = predictAssetDeltasFromCalldata({
      from: FROM,
      to: TO,
      value: 1_000_000n,
      chainId: 1,
    });
    assert.equal(deltas.length, 1);
    assert.equal(deltas[0]?.kind, "native");
    assert.equal(deltas[0]?.direction, "out");
    assert.equal(deltas[0]?.amount, 1_000_000n);
    assert.equal(coverage, "full");
  });

  it("emits a transfer-out delta for ERC-20 transfer(addr, amount)", () => {
    const data = encodeFunctionData({
      abi: [parseAbiItem("function transfer(address to, uint256 amount)")],
      args: [TO, 5_000n],
    });
    const { deltas, coverage } = predictAssetDeltasFromCalldata({
      from: FROM,
      to: TOKEN,
      data,
      chainId: 1,
    });
    assert.equal(coverage, "full");
    assert.equal(deltas.length, 1);
    assert.equal(deltas[0]?.kind, "transfer");
    assert.equal(deltas[0]?.direction, "out");
    assert.equal(deltas[0]?.amount, 5_000n);
    assert.equal(deltas[0]?.token, TOKEN);
    assert.equal(deltas[0]?.counterparty.toLowerCase(), TO);
  });

  it("flags approve(uint256.max) as unlimited", () => {
    const max = (1n << 256n) - 1n;
    const data = encodeFunctionData({
      abi: [parseAbiItem("function approve(address spender, uint256 amount)")],
      args: [SPENDER, max],
    });
    const { deltas } = predictAssetDeltasFromCalldata({
      from: FROM,
      to: TOKEN,
      data,
      chainId: 1,
    });
    assert.equal(deltas.length, 1);
    assert.equal(deltas[0]?.kind, "approve");
    assert.equal(deltas[0]?.amount, "unlimited");
    assert.equal(deltas[0]?.counterparty.toLowerCase(), SPENDER);
  });

  it("emits an approveAll delta for setApprovalForAll(operator, true)", () => {
    const data = encodeFunctionData({
      abi: [
        parseAbiItem(
          "function setApprovalForAll(address operator, bool approved)",
        ),
      ],
      args: [SPENDER, true],
    });
    const { deltas } = predictAssetDeltasFromCalldata({
      from: FROM,
      to: TOKEN,
      data,
      chainId: 1,
    });
    assert.equal(deltas.length, 1);
    assert.equal(deltas[0]?.kind, "approveAll");
    assert.equal(deltas[0]?.amount, "unlimited");
  });

  it("returns coverage=partial for unrecognised calldata", () => {
    const data = "0xdeadbeef" as `0x${string}`;
    const { deltas, coverage } = predictAssetDeltasFromCalldata({
      from: FROM,
      to: TOKEN,
      data,
      chainId: 1,
    });
    assert.equal(deltas.length, 0);
    assert.equal(coverage, "partial");
  });
});
