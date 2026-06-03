/**
 * Unit tests for `settleX402PaymentEvm` — rail selection, budget gate,
 * fee-safety bound, and error sanitisation (spec Phase 5 §8). Run under
 * `node:test` via `pnpm test:node`.
 */

import { strict as a } from "node:assert";
import { test } from "node:test";
import type {
  SettleX402PaymentArgs,
  X402Erc7710Challenge,
} from "../types.ts";
import {
  encodeProofEnvelope,
  settleX402PaymentEvm,
  type X402SettleDeps,
} from "./x402Settle.ts";

const CHAIN = { namespace: "eip155", chain: { id: 84532 } } as never;
const WALLET = { address: "0xabc" } as never;
const DELEGATION = {
  delegate: "0x4e44e22ee6da76c2ad19baaaffb52f676230fa06",
  delegator: "0x000000000000000000000000000000000000bEEF",
  authority:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  caveats: [],
  salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
  signature: "0xdead",
} as never;

function challenge(
  overrides: Partial<X402Erc7710Challenge> = {},
): X402Erc7710Challenge {
  return {
    scheme: "exact",
    network: "eip155:84532",
    maxAmountRequired: "20000",
    payTo: "0x000000000000000000000000000000000000dEaD",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    resource: "https://seller.example/api/v1/pool-safety",
    assetTransferMethod: "erc7710",
    ...overrides,
  };
}

function args(
  overrides: Partial<SettleX402PaymentArgs> = {},
): SettleX402PaymentArgs {
  return {
    wallet: WALLET,
    chain: CHAIN,
    challenge: challenge(),
    delegation: DELEGATION,
    remainingBudgetAtoms: 5_000_000n,
    ...overrides,
  };
}

function deps(overrides: Partial<X402SettleDeps> = {}): X402SettleDeps {
  return {
    getCapabilities: async () => ({
      84532: {
        targetAddress: "0xf1ef956eff4181Ce913b664713515996858B9Ca9",
        feeCollector: "0xE936e8FAf4A5655469182A49a505055B71C17604",
        tokens: [],
      },
    }),
    getFeeData: async () => ({
      minFee: 1_000n,
      tokenDecimals: 6,
    }),
    estimate: async () => ({
      success: true,
      requiredPaymentAmount: 10_000n,
      context: "fee-ctx",
    }),
    send: async () => ({ taskId: "0xtask" }),
    getStatus: async () => ({
      status: "success",
      statusCode: 200,
      transactionHash: "0xhash",
    }),
    pollIntervalMs: 0,
    pollTimeoutMs: 1000,
    now: () => 0,
    sleep: async () => {},
    ...overrides,
  };
}

test("settles within budget via the relayer rail and returns a tx-hash proof", async () => {
  const result = await settleX402PaymentEvm(args(), deps());
  a.equal(result.status, "settled");
  if (result.status !== "settled") return;
  a.equal(result.rail, "relayer");
  a.equal(result.txHash, "0xhash");
  a.equal(result.spentAtoms, 20_000n);
  // Proof is a base64 envelope carrying the tx hash.
  const decoded = JSON.parse(globalThis.atob(result.proof));
  a.equal(decoded.txHash, "0xhash");
  a.equal(decoded.rail, "relayer");
});

test("SI-1: requested over the remaining budget → over_budget", async () => {
  const result = await settleX402PaymentEvm(
    args({ remainingBudgetAtoms: 10_000n }),
    deps(),
  );
  a.equal(result.status, "over_budget");
  if (result.status === "over_budget") {
    a.equal(result.requestedAtoms, 20_000n);
    a.equal(result.remainingBudgetAtoms, 10_000n);
  }
});

test("SI-2: an over-bound fee fails with friendly copy (no raw detail)", async () => {
  const result = await settleX402PaymentEvm(
    args(),
    deps({
      // 6 USDC fee > the $5 safety ceiling.
      estimate: async () => ({
        success: true,
        requiredPaymentAmount: 6_000_000n,
        context: "fee-ctx",
      }),
    }),
  );
  a.equal(result.status, "failed");
  if (result.status === "failed") {
    a.match(result.reason, /couldn't settle/i);
  }
});

test("estimate failure → friendly failed result", async () => {
  const result = await settleX402PaymentEvm(
    args(),
    deps({ estimate: async () => ({ success: false, error: "simulation failed" }) }),
  );
  a.equal(result.status, "failed");
});

test("rail selection: a facilitator-named challenge still settles (falls back to relayer)", async () => {
  const result = await settleX402PaymentEvm(
    args({ challenge: challenge({ facilitator: "https://facilitator.example" }) }),
    deps(),
  );
  // Rail A SDK isn't wired yet → relayer rail handles it; never a chain branch.
  a.equal(result.status, "settled");
  if (result.status === "settled") a.equal(result.rail, "relayer");
});

test("encodeProofEnvelope round-trips through base64", () => {
  const proof = encodeProofEnvelope({
    challenge: challenge(),
    rail: "relayer",
    txHash: "0xfeed",
  });
  const decoded = JSON.parse(globalThis.atob(proof));
  a.equal(decoded.network, "eip155:84532");
  a.equal(decoded.txHash, "0xfeed");
});
