/**
 * CAIP-2 namespace mapping for WalletConnect v2.
 * Extensible: adding Solana / Sui is one entry.
 */

import type { Namespace } from "@/services/chains/types";

// CAIP-2 format: "namespace:reference"
// e.g., "eip155:1" → Ethereum mainnet
//      "sui:mainnet" → Sui mainnet (non-numeric reference)

// Sui CAIP-2 references are short network names, not numeric chain IDs.
// We map them to virtual integers so the existing `chainId: number`
// surface stays stable for callers that only handle numeric refs.
const SUI_NETWORK_TO_VCHAINID: Record<string, number> = {
  mainnet: 1,
  testnet: 2,
  devnet: 3,
};

export function caip2ToNamespace(
  caip2: string,
): { namespace: Namespace; chainId: number } | null {
  const [ns, ref] = caip2.split(":");
  if (!ns || !ref) return null;

  const mapping: Record<string, Namespace> = {
    eip155: "eip155",
    solana: "solana",
    sui: "sui",
  };

  const namespace = mapping[ns];
  if (!namespace) return null;

  if (namespace === "sui") {
    const vChain = SUI_NETWORK_TO_VCHAINID[ref];
    if (vChain === undefined) return null;
    return { namespace, chainId: vChain };
  }

  const chainId = parseInt(ref, 10);
  if (isNaN(chainId)) return null;

  return { namespace, chainId };
}

export function namespaceToCaip2(
  namespace: Namespace,
  chainId: number,
): string {
  const nsMapping: Record<Namespace, string> = {
    eip155: "eip155",
    solana: "solana",
    sui: "sui",
  };

  if (namespace === "sui") {
    const ref = Object.keys(SUI_NETWORK_TO_VCHAINID).find(
      (k) => SUI_NETWORK_TO_VCHAINID[k] === chainId,
    );
    return `sui:${ref ?? "mainnet"}`;
  }

  return `${nsMapping[namespace]}:${chainId}`;
}

export function accountToCaip10(
  namespace: Namespace,
  chainId: number,
  address: string,
): string {
  return `${namespaceToCaip2(namespace, chainId)}:${address}`;
}
