/**
 * Token approval management — revoke calldata builders.
 */

import { encodeFunctionData, erc20Abi, getAddress, maxUint256, formatUnits } from "viem";
import type { TokenApproval } from "@/services/indexer/types";

const ERC721_SET_APPROVAL_ABI = [
  {
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    name: "setApprovalForAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export function buildRevokeCalldata(approval: TokenApproval): `0x${string}` {
  if (approval.tokenType === "ERC-20") {
    return encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [getAddress(approval.spender), 0n],
    });
  }

  // ERC-721 or ERC-1155
  return encodeFunctionData({
    abi: ERC721_SET_APPROVAL_ABI,
    functionName: "setApprovalForAll",
    args: [getAddress(approval.spender), false],
  });
}

export function isUnlimitedAllowance(allowance: bigint | "unlimited"): boolean {
  if (allowance === "unlimited") return true;
  if (typeof allowance === "bigint") {
    return allowance >= maxUint256 / 2n;
  }
  return false;
}

export function formatAllowance(allowance: bigint | "unlimited", decimals: number): string {
  if (isUnlimitedAllowance(allowance)) return "Unlimited";
  if (typeof allowance === "bigint") {
    return parseFloat(formatUnits(allowance, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return "0";
}
