/**
 * Liquid Staking Token detection + underlying value calculation.
 */

import { getAddress, parseAbi, formatEther } from "viem";
import { getPublicClient } from "@/utils/clients";
import { mainnet } from "viem/chains";

// Curated allowlist of known LSTs
const LST_CONFIG: Record<string, {
  symbol: string;
  name: string;
  rateMethod?: string;
  rateContract?: string;
  apy?: number;
}> = {
  "0xae7ab96520de3a18e5e111b5eaab095312d7fe84": {
    symbol: "stETH", name: "Lido Staked Ether", apy: 3.5,
  },
  "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0": {
    symbol: "wstETH", name: "Wrapped stETH", apy: 3.5,
    rateContract: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
    rateMethod: "stEthPerToken",
  },
  "0xae78736cd615f374d3085123a210448e74fc6393": {
    symbol: "rETH", name: "Rocket Pool ETH", apy: 3.2,
    rateContract: "0xae78736Cd615f374D3085123A210448E74Fc6393",
    rateMethod: "getExchangeRate",
  },
  "0xbe9895146f7af43049ca1c1ae358b0541ea49704": {
    symbol: "cbETH", name: "Coinbase Wrapped Staked ETH", apy: 3.0,
    rateContract: "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704",
    rateMethod: "exchangeRate",
  },
};

export interface LSTInfo {
  contractAddress: string;
  symbol: string;
  name: string;
  isLST: true;
  underlyingSymbol: string;
  exchangeRate: number;
  apy: number;
}

export function isLST(contractAddress: string): boolean {
  return contractAddress.toLowerCase() in LST_CONFIG;
}

export function getLSTInfo(contractAddress: string): LSTInfo | null {
  const config = LST_CONFIG[contractAddress.toLowerCase()];
  if (!config) return null;

  return {
    contractAddress,
    symbol: config.symbol,
    name: config.name,
    isLST: true,
    underlyingSymbol: "ETH",
    exchangeRate: 1, // Will be updated by getExchangeRate
    apy: config.apy ?? 0,
  };
}

export async function getExchangeRate(contractAddress: string): Promise<number> {
  const config = LST_CONFIG[contractAddress.toLowerCase()];
  if (!config?.rateContract || !config?.rateMethod) {
    // stETH is 1:1 (rebasing)
    return 1;
  }

  const client = getPublicClient(mainnet);
  const abi = parseAbi([`function ${config.rateMethod}() view returns (uint256)`]);

  try {
    const rate = await client.readContract({
      address: getAddress(config.rateContract),
      abi,
      functionName: config.rateMethod,
    });
    return parseFloat(formatEther(rate as bigint));
  } catch {
    return 1;
  }
}

export function getAllLSTAddresses(): string[] {
  return Object.keys(LST_CONFIG);
}
