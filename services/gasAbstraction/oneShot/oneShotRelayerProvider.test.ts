/**
 * Tests for the 1Shot relayer provider orchestration core.
 *
 * Drives the exported pure helpers with a fake `RelayerKit` — no network,
 * no keystore. Covers fee-token resolution, the rough quote, the fee-leg
 * bundle, the estimate re-sign loop, SI-4, and the auto-upgrade
 * `authorizationList`.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { baseSepolia } from "viem/chains";
import type { ChainConfig } from "@/constants/configs/chainConfig";
import type { TWallet } from "@/constants/types/walletTypes";
import { RelayerRpcError } from "@/services/walletKit/evm/relayer";
import {
  computeRoughFee,
  quoteRelayerTransfer,
  type RelayerKit,
  resolveRelayerContext,
  runRelayerTransfer,
} from "./oneShotRelayerProvider";

const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const IDRX = "0x1aC593085Fa34c651E805085da4b2cabAC676F99";
const FEE_COLLECTOR = "0xE936e8FAf4A5655469182A49a505055B71C17604";
const TARGET = "0x4e44e22ee6da76c2ad19baaaffb52f676230fa06";
const RECIPIENT = "0x3e6a2f0CBA03d293B54c9fCF354948903007a798";
const WALLET_ADDR = "0x1111111111111111111111111111111111111111";

const chain: ChainConfig = { namespace: "eip155", chain: baseSepolia };
const wallet = { address: WALLET_ADDR, namespace: "eip155" } as TWallet;

// Sending USDC itself — work token == fee token.
const intent = {
  to: RECIPIENT,
  tokenAddress: USDC,
  amount: 500_000n, // 0.5 USDC
  decimals: 6,
};

// Sending IDRX while paying gas in USDC — work token != fee token.
const idrxIntent = {
  to: RECIPIENT,
  tokenAddress: IDRX,
  amount: 9_800_000n, // 98000 IDRX (2 decimals)
  decimals: 2,
};

interface FakeOpts {
  active?: boolean;
  minFee?: bigint;
  /** requiredPaymentAmount returned by successive estimate calls. */
  requiredFees?: bigint[];
  estimateSuccess?: boolean;
  acceptedToken?: string;
  /** Symbol the relayer tags the accepted token with (default USDC). */
  acceptedSymbol?: string;
  /** Relayer error code to throw on each successive send (null = succeed). */
  sendErrorCodes?: (number | null)[];
}

interface Recorder {
  createScopes: {
    maxAmount?: bigint;
    tokenAddress?: string;
    delegate?: string;
  }[];
  estimateCalls: { authorizationList?: unknown[] }[];
  sendCalls: {
    context: string;
    authorizationList?: unknown[];
    transactions: unknown[];
  }[];
  authSigned: number;
  sendAttempts: number;
}

function makeKit(opts: FakeOpts = {}): { kit: RelayerKit; rec: Recorder } {
  const minFee = opts.minFee ?? 100_000n;
  const requiredFees = opts.requiredFees ?? [minFee];
  const acceptedToken = opts.acceptedToken ?? USDC;
  let estimateIdx = 0;

  let sendIdx = 0;
  const rec: Recorder = {
    createScopes: [],
    estimateCalls: [],
    sendCalls: [],
    authSigned: 0,
    sendAttempts: 0,
  };

  const kit: RelayerKit = {
    async getRelayerCapabilities() {
      return {
        [baseSepolia.id]: {
          targetAddress: TARGET,
          feeCollector: FEE_COLLECTOR,
          tokens: [
            {
              address: acceptedToken,
              symbol: opts.acceptedSymbol ?? "USDC",
              decimals: 6,
            },
          ],
        },
      };
    },
    async getRelayerFeeData() {
      return {
        gasPrice: 1_000_000n,
        rate: 0.000001,
        minFee,
        tokenDecimals: 6,
        expiry: Math.floor(Date.now() / 1000) + 45,
        context: "0xrough",
      };
    },
    async isSmartAccountActive() {
      return opts.active ?? true;
    },
    async signEip7702Authorization() {
      rec.authSigned += 1;
      return {
        address: TARGET,
        chainId: baseSepolia.id,
        nonce: 0,
        r: "0xr",
        s: "0xs",
        yParity: 0,
      };
    },
    async createDelegation({ delegate, scope }) {
      rec.createScopes.push({
        maxAmount: scope.maxAmount,
        tokenAddress: scope.tokenAddress,
        delegate,
      });
      return {
        delegate: delegate as `0x${string}`,
        delegator: WALLET_ADDR as `0x${string}`,
        authority: `0x${"0".repeat(64)}` as `0x${string}`,
        caveats: [],
        salt: `0x${"1".repeat(64)}` as `0x${string}`,
      };
    },
    async signDelegation() {
      return "0xsignature";
    },
    async estimate7710Transaction({ authorizationList }) {
      rec.estimateCalls.push({ authorizationList });
      const required =
        requiredFees[Math.min(estimateIdx, requiredFees.length - 1)];
      estimateIdx += 1;
      if (opts.estimateSuccess === false) {
        return { success: false, error: "Simulation Failed" };
      }
      return {
        success: true,
        requiredPaymentAmount: required,
        context: `0xlock${estimateIdx}`,
      };
    },
    async send7710Transaction({ context, authorizationList, transactions }) {
      rec.sendAttempts += 1;
      const code = opts.sendErrorCodes?.[sendIdx] ?? null;
      sendIdx += 1;
      if (typeof code === "number") {
        throw new RelayerRpcError("relayer_send7710Transaction", code);
      }
      rec.sendCalls.push({ context, authorizationList, transactions });
      return { taskId: "0xtaskid" };
    },
  };

  return { kit, rec };
}

describe("resolveRelayerContext", () => {
  it("resolves USDC as the fee token when sending USDC (same token)", async () => {
    const { kit } = makeKit();
    const res = await resolveRelayerContext(kit, { wallet, chain, intent });
    assert.equal(res.feeToken.address, USDC);
    assert.equal(res.workTokenAddress, USDC);
    assert.equal(res.sameToken, true);
    assert.equal(res.chainCaps.targetAddress, TARGET);
  });

  it("resolves USDC as the fee token when sending a different token (IDRX)", async () => {
    const { kit } = makeKit();
    const res = await resolveRelayerContext(kit, {
      wallet,
      chain,
      intent: idrxIntent,
    });
    // Gas settings is the source of truth: fee is USDC even though IDRX is
    // what's being sent.
    assert.equal(res.feeToken.address, USDC);
    assert.equal(res.workTokenAddress, IDRX);
    assert.equal(res.sameToken, false);
  });

  it("declines when USDC is not an accepted fee token", async () => {
    const { kit } = makeKit({ acceptedSymbol: "DAI" });
    await assert.rejects(
      () => resolveRelayerContext(kit, { wallet, chain, intent }),
      (err: Error) => err.name === "GasAbstractionUnavailableError",
    );
  });
});

describe("computeRoughFee", () => {
  it("floors at minFee", () => {
    const fee = computeRoughFee(
      {
        gasPrice: 1n,
        rate: 0,
        minFee: 100_000n,
        tokenDecimals: 6,
        expiry: 0,
        context: "",
      },
      250_000n,
    );
    assert.equal(fee, 100_000n);
  });

  it("uses the rate as a native-token price (no atoms overflow)", () => {
    // Live Base Sepolia values: gasPrice 7199999 wei, rate 2000 USDC/ETH,
    // 6dp, minFee 0.01 USDC = 10_000 atoms. Gas-based fee (~3600 atoms) is
    // below the floor, so the result is the floor — and NOT the ~3.6e15
    // atoms the old wei×rate formula produced.
    const fee = computeRoughFee(
      {
        gasPrice: 7_199_999n,
        rate: 2000,
        minFee: 10_000n,
        tokenDecimals: 6,
        expiry: 0,
        context: "",
      },
      250_000n,
    );
    assert.equal(fee, 10_000n);
  });
});

describe("quoteRelayerTransfer", () => {
  it("totalRequired = fee + amount when sending USDC (same token)", async () => {
    const { kit } = makeKit({ minFee: 100_000n });
    const quote = await quoteRelayerTransfer(kit, { wallet, chain, intent });
    assert.equal(quote.providerId, "1shot");
    assert.equal(quote.feeToken.address, USDC);
    assert.equal(quote.feeAmount >= 100_000n, true);
    assert.equal(quote.totalRequired, quote.feeAmount + intent.amount);
  });

  it("totalRequired = fee only when sending a different token (IDRX)", async () => {
    const { kit } = makeKit({ minFee: 100_000n });
    const quote = await quoteRelayerTransfer(kit, {
      wallet,
      chain,
      intent: idrxIntent,
    });
    // The USDC balance gate only needs to cover the fee; the IDRX balance
    // is validated on its own token by the send flow.
    assert.equal(quote.feeToken.address, USDC);
    assert.equal(quote.totalRequired, quote.feeAmount);
  });
});

describe("runRelayerTransfer", () => {
  it("scopes the delegation to fee+work, prepends the fee leg, and returns the taskId", async () => {
    const { kit, rec } = makeKit({
      minFee: 100_000n,
      requiredFees: [100_000n],
    });
    const res = await runRelayerTransfer(kit, { wallet, chain, intent });

    assert.equal(res.taskId, "0xtaskid");
    // single estimate (required == mock), single delegation
    assert.equal(rec.estimateCalls.length, 1);
    assert.equal(rec.createScopes.length, 1);
    // scope maxAmount = fee + work; token = USDC; SI-4 delegate = target
    assert.equal(rec.createScopes[0].maxAmount, 100_000n + intent.amount);
    assert.equal(rec.createScopes[0].tokenAddress, USDC);
    assert.equal(rec.createScopes[0].delegate, TARGET);
    // send used the estimate's price-lock context
    assert.equal(rec.sendCalls[0].context, "0xlock1");
    // bundle: two executions (fee leg + work leg)
    const bundle = (
      rec.sendCalls[0].transactions as Array<{ executions: unknown[] }>
    )[0];
    assert.equal(bundle.executions.length, 2);
    // final price-locked fee + token surfaced for the success screen
    assert.equal(res.feeAmount, 100_000n);
    assert.equal(res.feeToken?.address, USDC);
  });

  it("sends two delegations (USDC fee + IDRX work) when the sent token differs", async () => {
    const { kit, rec } = makeKit({
      minFee: 100_000n,
      requiredFees: [100_000n],
    });
    const res = await runRelayerTransfer(kit, {
      wallet,
      chain,
      intent: idrxIntent,
    });

    assert.equal(res.taskId, "0xtaskid");
    // two delegations: USDC fee leg + IDRX work leg
    assert.equal(rec.createScopes.length, 2);
    assert.equal(rec.createScopes[0].tokenAddress, USDC);
    assert.equal(rec.createScopes[0].maxAmount, 100_000n);
    assert.equal(rec.createScopes[1].tokenAddress, IDRX);
    assert.equal(rec.createScopes[1].maxAmount, idrxIntent.amount);
    // both delegations delegate to the relayer target (SI-4)
    assert.equal(rec.createScopes[0].delegate, TARGET);
    assert.equal(rec.createScopes[1].delegate, TARGET);
    // bundle: two entries, one execution leg each
    const txs = rec.sendCalls[0].transactions as Array<{
      executions: unknown[];
    }>;
    assert.equal(txs.length, 2);
    assert.equal(txs[0].executions.length, 1);
    assert.equal(txs[1].executions.length, 1);
    // fee surfaced in USDC, not IDRX
    assert.equal(res.feeToken?.address, USDC);
  });

  it("re-signs at the required fee when the estimate differs from the mock", async () => {
    const { kit, rec } = makeKit({
      minFee: 100_000n,
      requiredFees: [150_000n, 150_000n],
    });
    await runRelayerTransfer(kit, { wallet, chain, intent });

    assert.equal(rec.estimateCalls.length, 2);
    assert.equal(rec.createScopes.length, 2);
    // second build uses the required fee
    assert.equal(rec.createScopes[1].maxAmount, 150_000n + intent.amount);
  });

  it("attaches an authorizationList when the wallet is not yet upgraded", async () => {
    const { kit, rec } = makeKit({ active: false });
    await runRelayerTransfer(kit, { wallet, chain, intent });
    assert.equal(rec.authSigned, 1);
    assert.equal(Array.isArray(rec.sendCalls[0].authorizationList), true);
  });

  it("omits the authorizationList when already upgraded", async () => {
    const { kit, rec } = makeKit({ active: true });
    await runRelayerTransfer(kit, { wallet, chain, intent });
    assert.equal(rec.authSigned, 0);
    assert.equal(rec.sendCalls[0].authorizationList, undefined);
  });

  it("throws a typed unavailable error when the estimate fails", async () => {
    const { kit } = makeKit({ estimateSuccess: false });
    await assert.rejects(
      () => runRelayerTransfer(kit, { wallet, chain, intent }),
      (err: Error) => err.name === "GasAbstractionUnavailableError",
    );
  });

  it("retries once with a fresh context on an expired quote (4204)", async () => {
    // First send throws 4204; the retry re-estimates (fresh context) and
    // resubmits without re-signing.
    const { kit, rec } = makeKit({ sendErrorCodes: [4204, null] });
    const res = await runRelayerTransfer(kit, { wallet, chain, intent });

    assert.equal(res.taskId, "0xtaskid");
    assert.equal(rec.sendAttempts, 2);
    // initial estimate + one refresh estimate
    assert.equal(rec.estimateCalls.length, 2);
    // delegation NOT re-signed on quote refresh (only the initial build)
    assert.equal(rec.createScopes.length, 1);
    // the successful send used the refreshed context
    assert.equal(rec.sendCalls[0].context, "0xlock2");
  });

  it("does NOT retry on a non-quote error (e.g. 4211)", async () => {
    const { kit, rec } = makeKit({ sendErrorCodes: [4211] });
    await assert.rejects(() =>
      runRelayerTransfer(kit, { wallet, chain, intent }),
    );
    assert.equal(rec.sendAttempts, 1);
  });
});
