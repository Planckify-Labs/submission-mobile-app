/**
 * `x402Settle` — EVM settlement for agent-initiated x402 micropayments
 * (spec Phase 5 §5.3, goal G2).
 *
 * Composes shipped primitives — it introduces NO new on-chain enforcer:
 *   - Phase 2 signed ERC-7710 allowance delegation (the budget).
 *   - Phase 3 1Shot relayer (`relayer.ts`) for gas-abstracted execution,
 *     already fee-bounded by `RELAYER_FEE_SAFETY_MAX_USDC_ATOMS`.
 *
 * Two rails, selected from the parsed challenge (never a chain-id branch):
 *   - **Rail A (facilitator).** When the seller names a facilitator that
 *     redeems the delegation itself. Requires the `@metamask/x402` /
 *     `@x402/*` buyer SDKs, which are NOT yet a dependency of this repo —
 *     so `settleViaFacilitator` is a documented seam that returns `null`
 *     until those packages land, and we fall through to the relayer rail.
 *   - **Rail B (relayer).** Re-encode the persisted user→agent delegation
 *     as the relayer `permissionContext` and execute a single
 *     `USDC.transfer(payTo, maxAmountRequired)` leg. The relayer tx hash
 *     is the `X-PAYMENT` proof (research-notes §5.1). This is the working
 *     default rail.
 *
 * Rules (mirror `relayer.ts` / `sendUserOpWithUsdcPaymaster.ts`):
 *   - `viem` is allowed here (this module lives under `evm/`).
 *   - No `react` / `react-native` / `expo` imports.
 *   - Returned `reason` is a SHORT FIXED LABEL only — never the server
 *     body / status / RPC payload (CLAUDE.md user-facing-errors, SI-6).
 *     Raw detail goes to a `__DEV__`-guarded log.
 */

import { encodeFunctionData, erc20Abi } from "viem";
import { assertEvmChain } from "../../../constants/configs/chainConfig.ts";
import type {
  RelayerBundleEntry,
  SettleX402PaymentArgs,
  SettleX402PaymentResult,
  X402Erc7710Challenge,
} from "../types.ts";
import {
  assertFeeWithinSafetyBound,
  relayerEstimate7710Transaction,
  relayerGetCapabilities,
  relayerGetFeeData,
  relayerGetStatus,
  relayerSend7710Transaction,
} from "./relayer.ts";

/** Build an ERC-20 `transfer` execution leg for a relayer bundle. */
function erc20TransferExecution(
  token: `0x${string}`,
  to: `0x${string}`,
  amount: bigint,
): RelayerBundleEntry["executions"][number] {
  return {
    target: token,
    value: 0n,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, amount],
    }),
  };
}

/**
 * Injectable seam for tests — defaults wire the real relayer client.
 * Keeping the relayer calls behind this object lets the rail-selection /
 * budget-gate / fee-bound logic be exercised under `node:test` with a
 * mocked relayer and no network.
 */
export interface X402SettleDeps {
  getCapabilities: typeof relayerGetCapabilities;
  getFeeData: typeof relayerGetFeeData;
  estimate: typeof relayerEstimate7710Transaction;
  send: typeof relayerSend7710Transaction;
  getStatus: typeof relayerGetStatus;
  /** Poll budget for the relayer task → terminal tx hash. */
  pollIntervalMs: number;
  pollTimeoutMs: number;
  /** Overridable clock / sleep for deterministic tests. */
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const DEFAULT_DEPS: X402SettleDeps = {
  getCapabilities: relayerGetCapabilities,
  getFeeData: relayerGetFeeData,
  estimate: relayerEstimate7710Transaction,
  send: relayerSend7710Transaction,
  getStatus: relayerGetStatus,
  pollIntervalMs: 3000,
  pollTimeoutMs: 90_000,
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** `__DEV__`-guarded raw logger — never reaches production users (SI-6). */
function logX402Debug(label: string, detail: unknown): void {
  const dev = typeof __DEV__ !== "undefined" ? __DEV__ : false;
  if (dev) {
    console.warn(`[x402Settle] ${label}`, detail);
  }
}

/** Fixed-label settlement failure copy (SI-6 — never embeds raw detail). */
function friendlySettlementError(): string {
  return "We couldn't settle this payment. Please try again.";
}

/**
 * Base64 `X-PAYMENT` proof envelope for the relayer rail — carries the tx
 * hash the seller verifies on-chain. Mirrors `encodeX402Envelope` in
 * `services/nanopay/pathCRawX402.ts` (ASCII-only header value).
 */
export function encodeProofEnvelope(args: {
  challenge: X402Erc7710Challenge;
  rail: "facilitator" | "relayer";
  txHash?: string;
}): string {
  const payload = {
    x402Version: 1,
    scheme: args.challenge.scheme,
    network: args.challenge.network,
    rail: args.rail,
    ...(args.txHash ? { txHash: args.txHash } : {}),
  };
  const json = JSON.stringify(payload);
  return globalThis.btoa
    ? globalThis.btoa(json)
    : (
        globalThis as unknown as {
          Buffer: { from(input: string): { toString(enc: string): string } };
        }
      ).Buffer.from(json).toString("base64");
}

/**
 * Rail A seam. The buyer SDKs (`@metamask/x402`, `@x402/*`) are not yet a
 * dependency, so this always returns `null` and the caller falls back to
 * the relayer rail. Wiring this is a drop-in once the packages land:
 * `wrapFetchWithPayment` + `createx402DelegationProvider` redeem the
 * delegation through the facilitator and the `PAYMENT-RESPONSE` is the
 * proof (spec §4.3).
 */
async function settleViaFacilitator(
  _args: SettleX402PaymentArgs,
): Promise<SettleX402PaymentResult | null> {
  return null;
}

/** Polls the relayer task to a terminal tx hash (mirrors pollTaskStatus). */
async function pollToTerminal(
  chainId: number,
  taskId: string,
  deps: X402SettleDeps,
): Promise<string> {
  const deadline = deps.now() + deps.pollTimeoutMs;
  while (deps.now() < deadline) {
    const status = await deps.getStatus({ chainId, taskId });
    if (status.status === "failed") throw new Error("relayer task failed");
    if (status.transactionHash) return status.transactionHash;
    await deps.sleep(deps.pollIntervalMs);
  }
  throw new Error("relayer task timed out");
}

/**
 * Settle a single x402 "exact" challenge for an EVM wallet (spec §5.3).
 * Budget gate (SI-1) → rail selection → fee-bound assert (SI-2) → settle
 * → proof. The on-chain caveat remains the cryptographic ceiling; this
 * function's gate only drives the silent-vs-prompt UX decision.
 */
export async function settleX402PaymentEvm(
  args: SettleX402PaymentArgs,
  deps: X402SettleDeps = DEFAULT_DEPS,
): Promise<SettleX402PaymentResult> {
  const { chain, challenge, delegation, remainingBudgetAtoms } = args;
  const chainId = assertEvmChain(chain).chain.id;

  let requestedAtoms: bigint;
  try {
    requestedAtoms = BigInt(challenge.maxAmountRequired);
  } catch {
    logX402Debug("unparseable maxAmountRequired", challenge.maxAmountRequired);
    return { status: "failed", reason: friendlySettlementError() };
  }

  // SI-1 budget gate. Hard ceiling is still the on-chain caveat.
  if (requestedAtoms > remainingBudgetAtoms) {
    return { status: "over_budget", requestedAtoms, remainingBudgetAtoms };
  }

  // Rail A — facilitator redeems the delegation. Returns `null` until the
  // buyer SDKs are added; we then fall through to the relayer rail.
  if (challenge.facilitator) {
    const viaFacilitator = await settleViaFacilitator(args).catch((err) => {
      logX402Debug("facilitator rail error", err);
      return null;
    });
    if (viaFacilitator) return viaFacilitator;
  }

  // Rail B — 1Shot relayer. Self-sponsored two-leg bundle (public-relayer
  // skill §Step 2): the relayer requires a USDC fee `transfer` to its
  // `feeCollector` in the calldata (without it: "No valid payments to the
  // feeAddress were found"), plus the actual payment `transfer` to the
  // challenge `payTo` (SI-3 — no agent-chosen recipient). The pre-signed
  // standing allowance's `erc20TransferAmount` cap already covers
  // `fee + payment`, so there is no per-call re-sign.
  try {
    // Resolve the relayer's fee collector + a starting fee floor.
    const caps = await deps.getCapabilities({ chainId });
    const feeCollector = caps[chainId]?.feeCollector as
      | `0x${string}`
      | undefined;
    if (!feeCollector || !/^0x[0-9a-fA-F]{40}$/.test(feeCollector)) {
      logX402Debug("no feeCollector from relayer capabilities", caps);
      return { status: "failed", reason: friendlySettlementError() };
    }
    const feeData = await deps.getFeeData({
      chainId,
      token: challenge.asset,
    });
    let feeAmount = feeData.minFee > 0n ? feeData.minFee : 1n;

    const buildBundle = (fee: bigint): RelayerBundleEntry => ({
      permissionContext: [delegation],
      executions: [
        erc20TransferExecution(challenge.asset, feeCollector, fee),
        erc20TransferExecution(challenge.asset, challenge.payTo, requestedAtoms),
      ],
    });

    let bundle = buildBundle(feeAmount);
    let estimate = await deps.estimate({ chainId, transactions: [bundle] });
    if (!estimate.success) {
      logX402Debug("estimate failed", estimate.error);
      return { status: "failed", reason: friendlySettlementError() };
    }
    // Honor the relayer's real required fee with ONE rebuild (no re-sign —
    // the standing delegation's cap covers fee + payment).
    if (
      estimate.requiredPaymentAmount !== undefined &&
      estimate.requiredPaymentAmount !== feeAmount
    ) {
      feeAmount = estimate.requiredPaymentAmount;
      bundle = buildBundle(feeAmount);
      estimate = await deps.estimate({ chainId, transactions: [bundle] });
      if (!estimate.success) {
        logX402Debug("re-estimate failed", estimate.error);
        return { status: "failed", reason: friendlySettlementError() };
      }
    }

    // SI-2: fee must stay within the safety envelope (checked before the
    // budget gate so an over-bound fee surfaces as a settlement failure,
    // not "over budget").
    try {
      assertFeeWithinSafetyBound(feeAmount);
    } catch (err) {
      logX402Debug("fee over safety bound", err);
      return { status: "failed", reason: friendlySettlementError() };
    }

    // SI-1: payment + fee both draw from the same allowance — the total
    // must fit the remaining budget.
    if (requestedAtoms + feeAmount > remainingBudgetAtoms) {
      return {
        status: "over_budget",
        requestedAtoms: requestedAtoms + feeAmount,
        remainingBudgetAtoms,
      };
    }

    const { taskId } = await deps.send({
      chainId,
      transactions: [bundle],
      context: estimate.context ?? "",
    });

    const txHash = await pollToTerminal(chainId, taskId, deps);

    return {
      status: "settled",
      rail: "relayer",
      txHash,
      proof: encodeProofEnvelope({ challenge, rail: "relayer", txHash }),
      spentAtoms: requestedAtoms,
    };
  } catch (err) {
    logX402Debug("relayer rail error", err);
    return { status: "failed", reason: friendlySettlementError() };
  }
}
