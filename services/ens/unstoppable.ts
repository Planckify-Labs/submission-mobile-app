/**
 * Unstoppable Domains resolution (.crypto, .wallet, .nft, .blockchain).
 * Returns same ENSResolution shape for unified handling.
 */

import type { ENSResolution } from "@/services/indexer/types";

const UD_EXTENSIONS = new Set([
  ".crypto",
  ".wallet",
  ".nft",
  ".blockchain",
  ".x",
  ".888",
  ".dao",
  ".zil",
]);

export function isUnstoppableDomain(name: string): boolean {
  return UD_EXTENSIONS.has(`.${name.split(".").pop()?.toLowerCase()}`);
}

export async function resolveUnstoppable(
  name: string,
): Promise<ENSResolution | null> {
  // Unstoppable Domains resolution via their public API
  // Falls back gracefully if unavailable
  try {
    const response = await fetch(
      `https://resolve.unstoppabledomains.com/domains/${encodeURIComponent(name)}`,
      {
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    const address =
      data.records?.["crypto.ETH.address"] ??
      data.records?.["crypto.MATIC.address"];

    if (!address) return null;

    return {
      name,
      address,
      chainId: 1,
    };
  } catch {
    return null;
  }
}
