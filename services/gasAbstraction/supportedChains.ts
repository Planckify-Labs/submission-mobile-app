/**
 * Static allowlist of chains where the 1Shot public relayer can abstract gas for
 * gas. This is the cheap, synchronous gate that decides whether to even
 * offer the USDC-gas option; the **authoritative** source at execution
 * time is the live `relayer_getCapabilities` response (the 1Shot docs say
 * the same: "Source of truth is the live relayer response").
 *
 * The default set mirrors the published "Supported Networks" table plus
 * the two testnets the relayer's `.dev` host serves. It is OTA-overridable
 * via `EXPO_PUBLIC_GAS_ABSTRACTION_CHAINS` (comma-separated chain ids) so
 * the list can track the relayer without an app release.
 *
 * Rules: no `react` / `react-native` / `viem` imports — Node-testable.
 */

import type { ChainConfig } from "@/constants/configs/chainConfig";

/**
 * Default 1Shot-supported viem chain ids: Ethereum, Optimism, BSC,
 * Unichain, Polygon, Monad, Sonic, Base, Arbitrum, Celo, Linea — plus
 * Base Sepolia + Sepolia (testnet `.dev` host).
 */
const DEFAULT_ABSTRACTION_CHAIN_IDS: readonly number[] = [
  1, 10, 56, 130, 137, 143, 146, 8453, 42161, 42220, 59144, 84532, 11155111,
];

function parseOverride(raw: string | undefined): number[] | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const ids = raw
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
  return ids.length > 0 ? ids : null;
}

/** Resolved allowlist — override wins when present and valid. */
export const GAS_ABSTRACTION_CHAIN_IDS: ReadonlySet<number> = new Set(
  parseOverride(process.env.EXPO_PUBLIC_GAS_ABSTRACTION_CHAINS) ??
    DEFAULT_ABSTRACTION_CHAIN_IDS,
);

/**
 * True when gas abstraction *may* be available for `chain`: it must be an
 * EVM chain whose id is in the allowlist. Non-EVM namespaces (Solana,
 * Sui) are always `false` — the feature simply doesn't apply there.
 */
export function isGasAbstractionSupported(chain: ChainConfig): boolean {
  if (chain.namespace !== "eip155") return false;
  return GAS_ABSTRACTION_CHAIN_IDS.has(chain.chain.id);
}
