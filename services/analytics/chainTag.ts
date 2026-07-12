import type { Namespace } from "@/services/chains/types";

// Single source of truth for the human-readable chain tag used across every
// analytics event's `chain` property — keeps "most used chain" breakdowns
// consistent instead of mixing raw namespace values ("eip155") with the
// friendlier ones dApp-bridge events already used ("evm").
const NAMESPACE_TO_CHAIN_TAG: Record<Namespace, string> = {
  eip155: "evm",
  solana: "solana",
  sui: "sui",
  stellar: "stellar",
};

export function toChainTag(namespace: Namespace): string {
  return NAMESPACE_TO_CHAIN_TAG[namespace];
}
