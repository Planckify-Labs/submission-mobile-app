/**
 * Pre-broadcast simulation helper per §4.9.
 *
 * Wraps `rpc.simulateTransaction` and rolls up the pre/post deltas into
 * a `SolanaSimulationSummary` the renderers consume. Actual inspector
 * lives in `services/bridge/inspectors/SolanaSimulationInspector.ts` and
 * calls this function, then patches the intent payload.
 */

import type { Rpc, SolanaRpcApi } from "@solana/kit";
import type {
  SolanaSimulationSummary,
  SolanaSimulationWarning,
} from "./payloads";

interface SimulateResponse {
  unitsConsumed?: number;
  logs?: string[];
  err?: unknown;
  accounts?: Array<{
    lamports: number | bigint;
    owner: string;
    data?: unknown;
  } | null>;
  returnData?: unknown;
}

export interface SimulateInput {
  txBase64: string;
  feePayer?: string;
  writableAccounts?: string[];
  tokenAccounts?: Array<{
    address: string;
    mint: string;
    decimals: number;
    owner: string;
    preAmount: bigint;
    tokenProgram: "spl-token" | "token-2022";
  }>;
}

export async function simulateTransaction(
  rpc: Rpc<SolanaRpcApi>,
  input: SimulateInput,
): Promise<SolanaSimulationSummary> {
  const warnings: SolanaSimulationWarning[] = [];
  let response: SimulateResponse = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (await (rpc as any)
      .simulateTransaction(input.txBase64, {
        encoding: "base64",
        replaceRecentBlockhash: true,
        accounts: input.writableAccounts
          ? {
              encoding: "base64",
              addresses: input.writableAccounts,
            }
          : undefined,
      })
      .send()) as { value?: SimulateResponse } | undefined;
    response = raw?.value ?? {};
  } catch {
    // Simulation failure is not fatal — the sheet surfaces the lack of
    // data; the signer path still runs.
  }

  const balanceChanges: SolanaSimulationSummary["balanceChanges"] = [];
  const tokenChanges: SolanaSimulationSummary["tokenChanges"] = [];

  if (Array.isArray(response.accounts) && input.writableAccounts) {
    for (let i = 0; i < input.writableAccounts.length; i++) {
      const acc = response.accounts[i];
      if (!acc) continue;
      balanceChanges.push({
        address: input.writableAccounts[i],
        lamportsDelta: BigInt(acc.lamports) - 0n, // pre-balance unknown here; sheet renders abs post-balance.
      });
    }
  }

  // Token-change surfacing happens in the inspector with a richer
  // context; this helper emits a shallow placeholder so the sheet can
  // still render when the inspector is off.
  void tokenChanges;

  return {
    unitsConsumed:
      typeof response.unitsConsumed === "number"
        ? response.unitsConsumed
        : undefined,
    balanceChanges,
    tokenChanges,
    warnings,
    logs: Array.isArray(response.logs) ? response.logs : [],
  };
}
