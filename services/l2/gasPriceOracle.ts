/**
 * L1 data fee estimation for OP Stack chains.
 */

import { formatEther, getAddress, parseAbi } from "viem";
import { supportedChains } from "@/constants/configs/chainConfig";
import { getPublicClient } from "@/utils/clients";

// OP Stack GasPriceOracle precompile address
const GAS_PRICE_ORACLE = "0x420000000000000000000000000000000000000F";

const gasPriceOracleAbi = parseAbi([
  "function getL1Fee(bytes _data) view returns (uint256)",
]);

const OP_STACK_CHAINS = new Set([10, 8453, 34443, 7777777, 480]);

export function isOPStackChain(chainId: number): boolean {
  return OP_STACK_CHAINS.has(chainId);
}

export async function getL1DataFee(
  chainId: number,
  txData: `0x${string}`,
): Promise<bigint | null> {
  if (!isOPStackChain(chainId)) return null;

  const chain = supportedChains.find((c) => c.chain.id === chainId)?.chain;
  if (!chain) return null;

  const client = getPublicClient(chain);

  try {
    const l1Fee = await client.readContract({
      address: getAddress(GAS_PRICE_ORACLE),
      abi: gasPriceOracleAbi,
      functionName: "getL1Fee",
      args: [txData],
    });
    return l1Fee;
  } catch {
    return null;
  }
}

export interface GasBreakdown {
  l2ExecutionFee: bigint;
  l1DataFee: bigint | null;
  totalFee: bigint;
}

export function formatGasBreakdown(breakdown: GasBreakdown): {
  l2: string;
  l1: string | null;
  total: string;
} {
  const format = (wei: bigint) => `${formatEther(wei)} ETH`;

  return {
    l2: format(breakdown.l2ExecutionFee),
    l1: breakdown.l1DataFee != null ? format(breakdown.l1DataFee) : null,
    total: format(breakdown.totalFee),
  };
}
