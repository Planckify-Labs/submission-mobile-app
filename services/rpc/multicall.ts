/**
 * Multicall batching for balanceOf and allowance aggregation.
 * Uses viem's built-in client.multicall() which handles Multicall3
 * contract interaction, batching, and failure isolation automatically.
 */

import { type Address, erc20Abi, getAddress, type PublicClient } from "viem";
import { findEvmChainById } from "@/constants/configs/chainConfig";
import { getPublicClient } from "@/utils/clients";

const MAX_BATCH_SIZE = 200;

// ─── Batch balance ───────────────────────────────────────────────────

export async function batchBalanceOf(
  owner: string,
  tokens: Array<{ contractAddress: string; decimals: number }>,
  chainId: number,
): Promise<Map<string, bigint>> {
  // TODO(task-05): move EVM-only lookups behind `EvmWalletKit`.
  const chain = findEvmChainById(chainId)?.chain;
  if (!chain) return new Map();

  const client = getPublicClient(chain);
  const ownerAddr = getAddress(owner);
  const results = new Map<string, bigint>();

  // Build batches respecting viem's multicall batch size
  const batches = chunkArray(tokens, MAX_BATCH_SIZE);

  for (const batch of batches) {
    const contracts = batch.map((token) => ({
      address: getAddress(token.contractAddress) as Address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [ownerAddr] as const,
    }));

    try {
      // viem's multicall handles Multicall3 interaction, encoding/decoding,
      // and failure isolation (allowFailure defaults to true)
      const multicallResults = await client.multicall({
        contracts,
        allowFailure: true,
      });

      for (let i = 0; i < batch.length; i++) {
        const result = multicallResults[i];
        if (result.status === "success") {
          results.set(batch[i].contractAddress.toLowerCase(), result.result);
        } else {
          results.set(batch[i].contractAddress.toLowerCase(), 0n);
        }
      }
    } catch {
      // Multicall not available — fallback to sequential reads
      for (const token of batch) {
        try {
          const balance = await client.readContract({
            address: getAddress(token.contractAddress),
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [ownerAddr],
          });
          results.set(token.contractAddress.toLowerCase(), balance);
        } catch {
          results.set(token.contractAddress.toLowerCase(), 0n);
        }
      }
    }
  }

  return results;
}

// ─── Batch allowance ─────────────────────────────────────────────────

export async function batchAllowance(
  owner: string,
  tokens: Array<{ contractAddress: string }>,
  spender: string,
  chainId: number,
): Promise<Map<string, bigint>> {
  // TODO(task-05): move EVM-only lookups behind `EvmWalletKit`.
  const chain = findEvmChainById(chainId)?.chain;
  if (!chain) return new Map();

  const client = getPublicClient(chain);
  const ownerAddr = getAddress(owner);
  const spenderAddr = getAddress(spender);
  const results = new Map<string, bigint>();

  const batches = chunkArray(tokens, MAX_BATCH_SIZE);

  for (const batch of batches) {
    const contracts = batch.map((token) => ({
      address: getAddress(token.contractAddress) as Address,
      abi: erc20Abi,
      functionName: "allowance" as const,
      args: [ownerAddr, spenderAddr] as const,
    }));

    try {
      const multicallResults = await client.multicall({
        contracts,
        allowFailure: true,
      });

      for (let i = 0; i < batch.length; i++) {
        const result = multicallResults[i];
        if (result.status === "success") {
          results.set(batch[i].contractAddress.toLowerCase(), result.result);
        } else {
          results.set(batch[i].contractAddress.toLowerCase(), 0n);
        }
      }
    } catch {
      // Sequential fallback
      for (const token of batch) {
        try {
          const allowance = await client.readContract({
            address: getAddress(token.contractAddress),
            abi: erc20Abi,
            functionName: "allowance",
            args: [ownerAddr, spenderAddr],
          });
          results.set(token.contractAddress.toLowerCase(), allowance);
        } catch {
          results.set(token.contractAddress.toLowerCase(), 0n);
        }
      }
    }
  }

  return results;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
