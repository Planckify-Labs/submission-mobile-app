/**
 * ERC-4626 vault detection + underlying value calculation.
 */

import { erc20Abi, formatEther, getAddress, parseAbi, parseEther } from "viem";
import { supportedChains } from "@/constants/configs/chainConfig";
import { getPublicClient } from "@/utils/clients";

const erc4626Abi = parseAbi([
  "function asset() view returns (address)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
]);

export interface VaultInfo {
  contractAddress: string;
  underlyingAsset: string;
  underlyingSymbol: string;
  exchangeRate: number;
  isVault: true;
}

export async function detectVault(
  contractAddress: string,
  chainId: number,
): Promise<VaultInfo | null> {
  const chain = supportedChains.find((c) => c.chain.id === chainId)?.chain;
  if (!chain) return null;

  const client = getPublicClient(chain);
  const addr = getAddress(contractAddress);

  try {
    // Check if contract implements ERC-4626 by calling asset()
    const asset = await client.readContract({
      address: addr,
      abi: erc4626Abi,
      functionName: "asset",
    });

    // Get underlying token symbol
    let underlyingSymbol = "Unknown";
    try {
      underlyingSymbol = await client.readContract({
        address: getAddress(asset),
        abi: erc20Abi,
        functionName: "symbol",
      });
    } catch {
      /* skip */
    }

    // Get exchange rate (1 share → X assets)
    const assetsPerShare = await client.readContract({
      address: addr,
      abi: erc4626Abi,
      functionName: "convertToAssets",
      args: [parseEther("1")],
    });

    return {
      contractAddress,
      underlyingAsset: asset,
      underlyingSymbol,
      exchangeRate: parseFloat(formatEther(assetsPerShare)),
      isVault: true,
    };
  } catch {
    return null;
  }
}
