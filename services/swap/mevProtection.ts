/**
 * MEV protection via Flashbots Protect RPC for Ethereum mainnet.
 */

import { type Chain, createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const FLASHBOTS_PROTECT_RPC = "https://rpc.flashbots.net";

// L2 chains where MEV protection is not applicable
const L2_CHAIN_IDS = new Set([
  10, // Optimism
  42161, // Arbitrum
  8453, // Base
  137, // Polygon (PoS, sequencer-ordered)
  324, // zkSync Era
  534352, // Scroll
  59144, // Linea
]);

export function isMevProtectionApplicable(chainId: number): boolean {
  return chainId === 1; // Only Ethereum mainnet
}

export function isL2Chain(chainId: number): boolean {
  return L2_CHAIN_IDS.has(chainId);
}

export function getFlashbotsClient() {
  return createPublicClient({
    chain: mainnet,
    transport: http(FLASHBOTS_PROTECT_RPC),
  });
}

export interface MevSettings {
  enabled: boolean;
}

let mevEnabled = true; // Default ON for mainnet

export function getMevSettings(): MevSettings {
  return { enabled: mevEnabled };
}

export function setMevEnabled(enabled: boolean): void {
  mevEnabled = enabled;
}
