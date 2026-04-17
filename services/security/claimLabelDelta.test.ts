/**
 * Tests for the claim-label / delta mismatch detector — TWV-2026-038.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/claimLabelDelta.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectClaimMismatch, looksLikeClaim } from "./claimLabelDelta.ts";
import type { AssetDelta } from "./txSimulator.ts";

const TOKEN = "0x000000000000000000000000000000000000bbbb" as const;
const COUNTERPARTY = "0x000000000000000000000000000000000000cccc" as const;

function inDelta(amount: bigint): AssetDelta {
  return {
    token: TOKEN,
    symbol: "REWARD",
    direction: "in",
    amount,
    counterparty: COUNTERPARTY,
    kind: "transfer",
  };
}
function outDelta(amount: bigint | "unlimited"): AssetDelta {
  return {
    token: TOKEN,
    symbol: "TOKEN",
    direction: "out",
    amount,
    counterparty: COUNTERPARTY,
    kind: "approve",
  };
}

describe("looksLikeClaim", () => {
  it("matches function names like claim*, harvest*, collect*, redeem*", () => {
    assert.equal(looksLikeClaim({ functionName: "claimRewards" }), true);
    assert.equal(looksLikeClaim({ functionName: "harvest" }), true);
    assert.equal(looksLikeClaim({ functionName: "collectFees" }), true);
    assert.equal(looksLikeClaim({ functionName: "redeem" }), true);
  });

  it("matches dApp labels", () => {
    assert.equal(looksLikeClaim({ dappLabel: "Claim rewards" }), true);
  });

  it("does NOT match unrelated labels", () => {
    assert.equal(looksLikeClaim({ functionName: "transfer" }), false);
    assert.equal(looksLikeClaim({ dappLabel: "Swap tokens" }), false);
  });
});

describe("detectClaimMismatch", () => {
  it("does NOT trigger for a claim with positive inflow", () => {
    const v = detectClaimMismatch({
      functionName: "claim",
      deltas: [inDelta(1_000n)],
    });
    assert.equal(v.triggered, false);
  });

  it("triggers for a claim with zero inflow", () => {
    const v = detectClaimMismatch({
      functionName: "claim",
      deltas: [],
    });
    assert.equal(v.triggered, true);
  });

  it("triggers for a claim with negative net inflow", () => {
    const v = detectClaimMismatch({
      functionName: "harvest",
      deltas: [inDelta(100n), outDelta(500n)],
    });
    assert.equal(v.triggered, true);
  });

  it("triggers when claim payload includes an unlimited approval", () => {
    const v = detectClaimMismatch({
      functionName: "claim",
      deltas: [outDelta("unlimited")],
    });
    assert.equal(v.triggered, true);
    assert.match(v.reason ?? "", /unlimited/);
  });

  it("does NOT trigger for a non-claim tx with zero inflow", () => {
    const v = detectClaimMismatch({
      functionName: "transfer",
      deltas: [],
    });
    assert.equal(v.triggered, false);
  });
});
