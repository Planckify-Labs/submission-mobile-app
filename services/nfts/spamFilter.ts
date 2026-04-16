/**
 * NFT spam detection heuristics.
 */

import type { NFTAsset } from "@/services/indexer/types";

const KNOWN_SPAM_COLLECTIONS = new Set([
  // Placeholder — updated via remote config
  "suspicious-airdrop.eth",
]);

export interface NFTSpamResult {
  isSpam: boolean;
  reason?: string;
}

export function checkNFTSpam(nft: NFTAsset): NFTSpamResult {
  // 1. Indexer-side flag
  if (nft.isSpam) {
    return { isSpam: true, reason: "Flagged by indexer" };
  }

  // 2. Known spam collection list
  if (nft.collection.slug && KNOWN_SPAM_COLLECTIONS.has(nft.collection.slug)) {
    return { isSpam: true, reason: "Known spam collection" };
  }

  // 3. Suspicious metadata patterns
  if (nft.metadata.name) {
    const lower = nft.metadata.name.toLowerCase();
    if (
      lower.includes("claim at ") ||
      lower.includes("visit ") ||
      lower.includes("airdrop from ") ||
      lower.includes("redeem at ")
    ) {
      return { isSpam: true, reason: "Phishing NFT name" };
    }
  }

  return { isSpam: false };
}
