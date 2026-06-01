/**
 * Unit tests for the local-grant → ERC-7710 scope/caveat bridge
 * (spec Phase 2 §8 "Verify Translation Logic").
 *
 * Run via Node's built-in `node:test` runner (type-stripping) — same
 * harness as `permissionGrantStore.test.ts`. Pure module, no RN imports.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildErc20AllowanceConfig,
  describeErc20Allowance,
  formatTokenAmount,
  formatTokenAmountDisplay,
  parseTokenAmount,
  randomDelegationSalt,
} from "./agentDelegationMapping.ts";

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

describe("buildErc20AllowanceConfig", () => {
  it("maps a timed allowance to erc20TransferAmount + timestamp (seconds)", () => {
    const expiresAtMs = 1_900_000_000_000; // arbitrary fixed ms
    const { scope, caveats } = buildErc20AllowanceConfig({
      tokenAddress: USDC,
      maxAmount: 50_000_000n,
      lifetime: { type: "timed", expiresAtMs },
    });

    assert.equal(scope.type, "erc20TransferAmount");
    assert.equal(scope.tokenAddress, USDC);
    assert.equal(scope.maxAmount, 50_000_000n);

    assert.equal(caveats.length, 1);
    assert.equal(caveats[0].type, "timestamp");
    // SI-3: expiry must be in seconds, non-zero, and match the lifetime.
    assert.equal(caveats[0].expiresAt, Math.floor(expiresAtMs / 1000));
  });

  it("maps a once allowance to a single-call limitedCalls caveat", () => {
    const { caveats } = buildErc20AllowanceConfig({
      tokenAddress: USDC,
      maxAmount: 1n,
      lifetime: { type: "once" },
    });
    assert.equal(caveats.length, 1);
    assert.equal(caveats[0].type, "limitedCalls");
    assert.equal(caveats[0].limit, 1);
  });

  it("honours an explicit session call limit", () => {
    const { caveats } = buildErc20AllowanceConfig({
      tokenAddress: USDC,
      maxAmount: 1n,
      lifetime: { type: "session" },
      callLimit: 5,
    });
    assert.equal(caveats[0].type, "limitedCalls");
    assert.equal(caveats[0].limit, 5);
  });

  it("emits no bounding caveat for a permanent allowance (cap still applies)", () => {
    const { scope, caveats } = buildErc20AllowanceConfig({
      tokenAddress: USDC,
      maxAmount: 100_000_000n,
      lifetime: { type: "permanent" },
    });
    assert.equal(caveats.length, 0);
    assert.equal(scope.maxAmount, 100_000_000n);
  });
});

describe("describeErc20Allowance", () => {
  it("renders a friendly, hand-written timed summary", () => {
    const nowMs = 1_000_000_000_000;
    const text = describeErc20Allowance({
      amountLabel: "$50 USDC",
      lifetime: { type: "timed", expiresAtMs: nowMs + 7 * 24 * 60 * 60 * 1000 },
      nowMs,
    });
    assert.match(text, /up to \$50 USDC/);
    assert.match(text, /7 days/);
  });

  it("describes permanent and once lifetimes", () => {
    assert.match(
      describeErc20Allowance({
        amountLabel: "$10 USDC",
        lifetime: { type: "permanent" },
      }),
      /until you revoke/i,
    );
    assert.match(
      describeErc20Allowance({
        amountLabel: "$10 USDC",
        lifetime: { type: "once" },
      }),
      /single payment/i,
    );
  });
});

describe("parseTokenAmount / formatTokenAmount", () => {
  it("parses USDC (6dp) without float error", () => {
    assert.equal(parseTokenAmount("50", 6), 50_000_000n);
    assert.equal(parseTokenAmount("0.5", 6), 500_000n);
    assert.equal(parseTokenAmount("1.234567", 6), 1_234_567n);
  });

  it("parses an 18dp token at full precision (overflow-safe)", () => {
    assert.equal(parseTokenAmount("100", 18), 100_000_000_000_000_000_000n);
  });

  it("truncates excess fractional digits and rejects junk", () => {
    assert.equal(parseTokenAmount("1.2345679", 6), 1_234_567n);
    assert.equal(parseTokenAmount("abc", 6), 0n);
    assert.equal(parseTokenAmount("-5", 6), 0n);
    assert.equal(parseTokenAmount("", 6), 0n);
  });

  it("round-trips through formatTokenAmount", () => {
    assert.equal(formatTokenAmount(50_000_000n, 6), "50");
    assert.equal(formatTokenAmount(1_234_567n, 6), "1.234567");
    assert.equal(formatTokenAmount(500_000n, 6), "0.5");
  });

  it("formatTokenAmountDisplay groups the integer part", () => {
    assert.equal(formatTokenAmountDisplay(1_000_000_000_000n, 6), "1,000,000");
    assert.equal(formatTokenAmountDisplay(1_234_567n, 6), "1.234567");
    assert.equal(formatTokenAmountDisplay(12_345_678_900n, 6), "12,345.6789");
    assert.equal(formatTokenAmountDisplay(500_000n, 6), "0.5");
  });
});

describe("randomDelegationSalt", () => {
  it("returns a 32-byte 0x-prefixed hex that varies (SI-4)", () => {
    const a = randomDelegationSalt();
    const b = randomDelegationSalt();
    assert.match(a, /^0x[0-9a-f]{64}$/);
    assert.match(b, /^0x[0-9a-f]{64}$/);
    assert.notEqual(a, b);
  });
});
