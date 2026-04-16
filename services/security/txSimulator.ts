// TWV-2026-011 — Pre-sign transaction simulation entry point. Single
// call site for both the user-signer path (EvmTransactionSheet) and the
// agent path so behaviour stays in parity (§7).
//
// Hard rules:
//   1. Simulator MUST run against a pinned RPC, NOT the dApp-supplied
//      one. Trusting the dApp's RPC defeats the control (Bybit-class).
//   2. Simulation failure (revert / network / unsupported chain) MUST
//      block the default Sign button. Opt-out is a distinct secondary
//      action surfaced by the UI, not a fall-through here.
//
// Asset-delta extraction is intentionally conservative — a full
// trace-based simulator (Tenderly-class) is a follow-up. The decoder
// below predicts deltas for the calldata patterns the wallet already
// classifies as risk-bearing (`transfer`, `approve`,
// `setApprovalForAll`); everything else returns an empty delta list
// with `coverage: "partial"` so the UI can warn the user that asset
// movement could not be enumerated.

import { type PublicClient } from "viem";
import { decodeCalldata } from "../decoders/calldata.ts";

export interface TxSimulationInput {
  to: `0x${string}`;
  from: `0x${string}`;
  value?: bigint;
  data?: `0x${string}`;
  chainId: number;
}

export type AssetDeltaDirection = "in" | "out";

export interface AssetDelta {
  /** Token contract or null for native currency. */
  token: `0x${string}` | null;
  symbol: string;
  direction: AssetDeltaDirection;
  /** Magnitude in token base units (10^decimals); "unlimited" for max approvals. */
  amount: bigint | "unlimited";
  /** Human label for the counterparty (recipient / spender). */
  counterparty: `0x${string}`;
  kind: "transfer" | "approve" | "approveAll" | "native";
}

export type TxSimulationResult =
  | {
      status: "ok";
      deltas: AssetDelta[];
      coverage: "full" | "partial";
      gasEstimate?: bigint;
    }
  | {
      status: "reverted";
      reason: string;
    }
  | {
      status: "transport_error";
      reason: string;
    }
  | {
      status: "unsupported_chain";
      reason: string;
    };

/**
 * Predict asset deltas from calldata WITHOUT a trace-based simulator.
 * Conservative — only the well-known risk-bearing selectors. Other
 * payloads return `coverage: "partial"`, which the UI must surface as
 * "asset movement could not be enumerated — sign with caution".
 */
export function predictAssetDeltasFromCalldata(
  input: TxSimulationInput,
): { deltas: AssetDelta[]; coverage: "full" | "partial" } {
  const deltas: AssetDelta[] = [];
  const decoded = decodeCalldata(input.data);

  if (input.value && input.value > 0n) {
    deltas.push({
      token: null,
      symbol: "ETH",
      direction: "out",
      amount: input.value,
      counterparty: input.to,
      kind: "native",
    });
  }

  if (!decoded || !decoded.signature) {
    return {
      deltas,
      coverage: input.value && input.value > 0n ? "full" : "partial",
    };
  }

  if (decoded.functionName === "transfer" && decoded.args) {
    const to = decoded.args[0]?.value as `0x${string}` | undefined;
    const amount = decoded.args[1]?.value as bigint | undefined;
    if (to && typeof amount === "bigint") {
      deltas.push({
        token: input.to,
        symbol: "TOKEN",
        direction: "out",
        amount,
        counterparty: to,
        kind: "transfer",
      });
      return { deltas, coverage: "full" };
    }
  }

  if (decoded.risk?.kind === "approve") {
    deltas.push({
      token: input.to,
      symbol: "TOKEN",
      direction: "out",
      amount: decoded.risk.isUnlimited ? "unlimited" : decoded.risk.amount,
      counterparty: decoded.risk.spender,
      kind: "approve",
    });
    return { deltas, coverage: "full" };
  }

  if (decoded.risk?.kind === "setApprovalForAll" && decoded.risk.approved) {
    deltas.push({
      token: input.to,
      symbol: "NFT collection",
      direction: "out",
      amount: "unlimited",
      counterparty: decoded.risk.operator,
      kind: "approveAll",
    });
    return { deltas, coverage: "full" };
  }

  return { deltas, coverage: "partial" };
}

/**
 * Run an `eth_call` against the pinned RPC to detect a pre-sign revert.
 * Returns the simulator verdict; never throws. Consumer MUST gate the
 * primary Sign button on `status === "ok"`.
 */
export async function simulateTransaction(
  pinnedClient: PublicClient,
  input: TxSimulationInput,
): Promise<TxSimulationResult> {
  // Chain-id parity gate — if the pinned client and the input disagree,
  // bail out instead of silently simulating against the wrong network.
  try {
    const reportedChainId = await pinnedClient.getChainId();
    if (reportedChainId !== input.chainId) {
      return {
        status: "unsupported_chain",
        reason: `pinned RPC chainId ${reportedChainId} ≠ tx chainId ${input.chainId}`,
      };
    }
  } catch (e) {
    return {
      status: "transport_error",
      reason: e instanceof Error ? e.message : String(e),
    };
  }

  let gasEstimate: bigint | undefined;
  try {
    // eth_call probes for revert; on success the asset-delta predictor
    // gives the user-facing summary.
    await pinnedClient.call({
      account: input.from,
      to: input.to,
      value: input.value,
      data: input.data,
    });
    try {
      gasEstimate = await pinnedClient.estimateGas({
        account: input.from,
        to: input.to,
        value: input.value,
        data: input.data,
      });
    } catch {
      // estimateGas can be flaky for some chains/contracts; the call
      // already passed so we don't fail the simulation on this.
    }
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    if (/revert/i.test(reason) || /execution reverted/i.test(reason)) {
      return { status: "reverted", reason };
    }
    return { status: "transport_error", reason };
  }

  const { deltas, coverage } = predictAssetDeltasFromCalldata(input);
  return { status: "ok", deltas, coverage, gasEstimate };
}
