/**
 * Read-only mobile tool executors.
 *
 * None of these require a signer — they all use the `publicClient`
 * from `chainRouter.resolveChainClients`. The agent protocol treats
 * these as `capability: "read"` tools: they are silent (no approval
 * UX) and may be emitted in parallel across different chain_ids.
 *
 * Tools implemented here:
 *   - get_balance            — arbitrary address balance lookup
 *   - get_wallet_balance     — connected wallet's own balance
 *   - read_contract          — view/pure contract call
 *   - get_transaction        — fetch tx receipt by hash
 *   - get_wallet_address     — return connected wallet address
 *   - get_supported_chains   — enumerate mobile's chain registry
 */

import type { Abi } from "viem";
import type { TBlockchain } from "@/api/types/blockchain";
import { pendingTxStore } from "../pendingTxStore";
import { resolveChainClients } from "./chainRouter";
import {
  ExecutorError,
  ExecutorErrorCode,
  type MobileToolExecutor,
  requireAddress,
  requireString,
  requireTxHash,
  resolveChainId,
  safeExecute,
} from "./types";

/**
 * `get_balance` — native token balance for an arbitrary address on a
 * specific chain. The server passes `{ address, chain_id }`.
 */
export const getBalance: MobileToolExecutor = (input, context) =>
  safeExecute(async () => {
    const chainId = resolveChainId(input, context);
    const address = requireAddress(input, "address");
    const { publicClient } = resolveChainClients(chainId, context);
    const balance = await publicClient.getBalance({ address });
    return {
      status: "success",
      data: {
        address,
        chain_id: chainId,
        balance_wei: balance.toString(),
      },
    };
  });

/**
 * `get_wallet_balance` — connected wallet's own native token balance on
 * the requested chain. Server input: `{ chain_id }` (address comes from
 * the wallet context).
 */
export const getWalletBalance: MobileToolExecutor = (input, context) =>
  safeExecute(async () => {
    const chainId = resolveChainId(input, context);
    const address = context.wallet.address as `0x${string}`;
    if (!address) {
      throw new ExecutorError(
        ExecutorErrorCode.WalletCannotExecute,
        "no connected wallet",
      );
    }
    const { publicClient } = resolveChainClients(chainId, context);
    const balance = await publicClient.getBalance({ address });
    return {
      status: "success",
      data: {
        address,
        chain_id: chainId,
        balance_wei: balance.toString(),
      },
    };
  });

/**
 * `read_contract` — generic view/pure call. Server sends:
 *   { chain_id, contract_address, abi, function_name, args? }
 */
export const readContract: MobileToolExecutor = (input, context) =>
  safeExecute(async () => {
    const chainId = resolveChainId(input, context);
    const contractAddress = requireAddress(input, "contract_address");
    const functionName = requireString(input, "function_name");
    const abi = input.abi;
    if (!Array.isArray(abi)) {
      throw new ExecutorError(
        ExecutorErrorCode.InvalidInput,
        "missing_or_invalid_abi",
      );
    }
    const args = Array.isArray(input.args) ? (input.args as unknown[]) : [];

    const { publicClient } = resolveChainClients(chainId, context);
    const result = await publicClient.readContract({
      address: contractAddress,
      abi: abi as Abi,
      functionName,
      args,
    });

    return {
      status: "success",
      data: {
        chain_id: chainId,
        contract_address: contractAddress,
        function_name: functionName,
        // viem may return bigint / nested bigints — JSON.stringify with
        // a bigint replacer so the SSE dispatcher can forward this.
        result: safeSerialize(result),
      },
    };
  });

/**
 * `get_transaction` — fetch a tx receipt by hash. Server input:
 *   { chain_id, tx_hash }
 *
 * Returns partial info if the tx is still pending (receipt missing).
 */
export const getTransaction: MobileToolExecutor = (input, context) =>
  safeExecute(async () => {
    const chainId = resolveChainId(input, context);
    const hash = requireTxHash(input, "tx_hash");
    const { publicClient } = resolveChainClients(chainId, context);

    // Try the receipt first — if it's missing, fall back to the tx
    // object so the agent can at least report "pending".
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash });

      // --- Task 15: flip the matching pending card ------------------
      // Per AGENT_PROTOCOL.md §1, confirmation is a read-path fact,
      // not a write-path one. This is the single place the mobile
      // decides a tx is confirmed / reverted. Unknown hashes are a
      // no-op inside the store, so fetching a receipt for a tx the
      // store never saw does not crash.
      if (receipt.status === "success") {
        pendingTxStore.markConfirmed(hash, Number(receipt.blockNumber));
      } else {
        // viem reports reverted receipts as `status: "reverted"`.
        // The error string is the literal the spec calls out.
        pendingTxStore.markFailed(hash, "Transaction reverted");
      }

      return {
        status: "success",
        tx_hash: hash,
        tx_confirmed: true,
        data: {
          chain_id: chainId,
          status: receipt.status,
          block_number: receipt.blockNumber.toString(),
          gas_used: receipt.gasUsed.toString(),
          from: receipt.from,
          to: receipt.to,
        },
      };
    } catch {
      const tx = await publicClient.getTransaction({ hash });
      return {
        status: "success",
        tx_hash: hash,
        tx_confirmed: false,
        data: {
          chain_id: chainId,
          pending: true,
          from: tx.from,
          to: tx.to,
          value_wei: tx.value.toString(),
        },
      };
    }
  });

/**
 * `get_wallet_address` — returns the connected wallet address. Does not
 * touch the chain, so `chain_id` is optional here.
 */
export const getWalletAddress: MobileToolExecutor = (_input, context) =>
  safeExecute(async () => {
    const address = context.wallet.address;
    if (!address) {
      throw new ExecutorError(
        ExecutorErrorCode.WalletCannotExecute,
        "no connected wallet",
      );
    }
    return {
      status: "success",
      data: { address },
    };
  });

/**
 * `get_supported_chains` — enumerate the mobile's EVM chain registry so
 * the agent can fan out cross-chain reads (protocol §3). Uses the live
 * `blockchains` list from the executor context; watches for `isEVM`
 * and `isActive` to match the registry guard in `chainRouter`.
 */
export const getSupportedChains: MobileToolExecutor = (_input, context) =>
  safeExecute(async () => {
    const rows: TBlockchain[] = context.blockchains.filter(
      (b) => b.isEVM && b.isActive,
    );

    const chains = rows.map((row) => {
      const native = row.tokens?.find((t) => t.isNativeCurrency);
      return {
        chain_id: row.chainId,
        name: row.name,
        native_symbol: native?.symbol ?? "ETH",
        native_decimals: native?.decimals ?? 18,
        rpc_url: row.rpcUrl,
        block_explorer: row.blockExplorer || null,
      };
    });

    return {
      status: "success",
      data: { chains },
    };
  });

/**
 * Recursively convert bigints (and nested bigints inside arrays /
 * objects) into base-10 strings so that the SSE dispatcher can safely
 * JSON.stringify the tool result without exploding on "Do not know how
 * to serialize a BigInt".
 */
function safeSerialize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(safeSerialize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = safeSerialize(v);
    }
    return out;
  }
  return value;
}

/**
 * Exported so the index can re-export a stable surface. The map here is
 * keyed on the server's canonical tool names from `TOOL_REGISTRY`.
 */
export const READ_EXECUTORS: Record<string, MobileToolExecutor> = {
  get_balance: getBalance,
  get_wallet_balance: getWalletBalance,
  read_contract: readContract,
  get_transaction: getTransaction,
  get_wallet_address: getWalletAddress,
  get_supported_chains: getSupportedChains,
};
