/**
 * CAIP-2 namespace mapping for WalletConnect v2.
 * Extensible: adding Solana is one entry.
 */

import type { Namespace } from "@/services/chains/types";

// CAIP-2 format: "namespace:reference"
// e.g., "eip155:1" → Ethereum mainnet

export function caip2ToNamespace(
  caip2: string,
): { namespace: Namespace; chainId: number } | null {
  const [ns, ref] = caip2.split(":");
  if (!ns || !ref) return null;

  const chainId = parseInt(ref, 10);
  if (isNaN(chainId)) return null;

  const mapping: Record<string, Namespace> = {
    eip155: "eip155",
    solana: "solana",
  };

  const namespace = mapping[ns];
  if (!namespace) return null;

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

  return `${nsMapping[namespace]}:${chainId}`;
}

export function accountToCaip10(
  namespace: Namespace,
  chainId: number,
  address: string,
): string {
  return `${namespaceToCaip2(namespace, chainId)}:${address}`;
}
