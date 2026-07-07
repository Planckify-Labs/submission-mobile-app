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

// Stellar CAIP-2 references (per CAIP-28,
// namespaces.chainagnostic.org/stellar/caip2) are `pubnet` / `testnet` —
// NOT `mainnet`. This is the one namespace where the CAIP-2 wire
// reference diverges from this app's internal `ChainConfig.network`
// value (`"mainnet"` | `"testnet"`); see {@link stellarNetworkToCaipReference}
// / {@link caipReferenceToStellarNetwork} for that translation. The
// virtual-chainId map below keys on the CAIP-2 reference string (mirroring
// the Sui map above, which keys on Sui's CAIP ref — for Sui the internal
// and CAIP names happen to be identical, so no separate translation was
// needed there).
const STELLAR_NETWORK_TO_VCHAINID: Record<string, number> = {
  pubnet: 1,
  testnet: 2,
};

/** Internal `ChainConfig.network` → CAIP-2 reference (`"mainnet"` → `"pubnet"`). */
export function stellarNetworkToCaipReference(
  network: "mainnet" | "testnet",
): "pubnet" | "testnet" {
  return network === "mainnet" ? "pubnet" : "testnet";
}

/** CAIP-2 reference → internal `ChainConfig.network`. `null` if unrecognised. */
export function caipReferenceToStellarNetwork(
  ref: string,
): "mainnet" | "testnet" | null {
  if (ref === "pubnet") return "mainnet";
  if (ref === "testnet") return "testnet";
  return null;
}

export function caip2ToNamespace(
  caip2: string,
): { namespace: Namespace; chainId: number } | null {
  const [ns, ref] = caip2.split(":");
  if (!ns || !ref) return null;

  const mapping: Record<string, Namespace> = {
    eip155: "eip155",
    solana: "solana",
    sui: "sui",
    stellar: "stellar",
  };

  const namespace = mapping[ns];
  if (!namespace) return null;

  if (namespace === "sui") {
    const vChain = SUI_NETWORK_TO_VCHAINID[ref];
    if (vChain === undefined) return null;
    return { namespace, chainId: vChain };
  }

  if (namespace === "stellar") {
    const vChain = STELLAR_NETWORK_TO_VCHAINID[ref];
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
    stellar: "stellar",
  };

  if (namespace === "sui") {
    const ref = Object.keys(SUI_NETWORK_TO_VCHAINID).find(
      (k) => SUI_NETWORK_TO_VCHAINID[k] === chainId,
    );
    return `sui:${ref ?? "mainnet"}`;
  }

  if (namespace === "stellar") {
    const ref = Object.keys(STELLAR_NETWORK_TO_VCHAINID).find(
      (k) => STELLAR_NETWORK_TO_VCHAINID[k] === chainId,
    );
    return `stellar:${ref ?? "pubnet"}`;
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
