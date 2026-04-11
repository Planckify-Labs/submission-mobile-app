/**
 * Simulation executors — currently just `estimate_gas`.
 *
 * Simulations are capability: "simulate" — the protocol suggests mobile
 * may show a brief preview but does not require user approval. The
 * estimator uses `publicClient.estimateGas` and returns the raw wei
 * value as a base-10 string (bigints cannot cross the SSE boundary).
 */

import type { Abi } from "viem";
import { resolveChainClients } from "./chainRouter";
import {
  ExecutorError,
  ExecutorErrorCode,
  type MobileToolExecutor,
  requireAddress,
  requireBigInt,
  requireString,
  resolveChainId,
  safeExecute,
} from "./types";

/**
 * `estimate_gas` — estimate gas for a prospective transaction without
 * submitting it. Server may send either a native-token transfer shape:
 *   { chain_id, to, value_wei }
 * or a contract-call shape:
 *   { chain_id, contract_address, abi, function_name, args?, value_wei? }
 *
 * Uses `publicClient.estimateGas` for the former and
 * `publicClient.estimateContractGas` for the latter.
 */
export const estimateGas: MobileToolExecutor = (input, context) =>
  safeExecute(async () => {
    const chainId = resolveChainId(input, context);
    const { publicClient } = resolveChainClients(chainId, context);

    const account = context.wallet.address as `0x${string}` | undefined;
    if (!account) {
      throw new ExecutorError(
        ExecutorErrorCode.WalletCannotExecute,
        "no connected wallet",
      );
    }

    const contractAddress = input.contract_address;
    if (typeof contractAddress === "string") {
      // Contract call shape.
      const address = requireAddress(input, "contract_address");
      const functionName = requireString(input, "function_name");
      const abi = input.abi;
      if (!Array.isArray(abi)) {
        throw new ExecutorError(
          ExecutorErrorCode.InvalidInput,
          "missing_or_invalid_abi",
        );
      }
      const args = Array.isArray(input.args) ? (input.args as unknown[]) : [];
      const value =
        input.value_wei !== undefined ? requireBigInt(input, "value_wei") : 0n;

      const gas = await publicClient.estimateContractGas({
        account,
        address,
        abi: abi as Abi,
        functionName,
        args,
        value,
      });
      return {
        status: "success",
        data: { chain_id: chainId, gas_wei: gas.toString() },
      };
    }

    // Plain transfer shape.
    const to = requireAddress(input, "to");
    const value =
      input.value_wei !== undefined ? requireBigInt(input, "value_wei") : 0n;
    const gas = await publicClient.estimateGas({
      account,
      to,
      value,
    });
    return {
      status: "success",
      data: { chain_id: chainId, gas_wei: gas.toString() },
    };
  });

export const SIMULATE_EXECUTORS: Record<string, MobileToolExecutor> = {
  estimate_gas: estimateGas,
};
