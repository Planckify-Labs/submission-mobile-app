/**
 * DeepBook v3 pool config — network-keyed ("config not constants", §4.6).
 *
 * Pool keys are DeepBook's own pre-registered keys (verified from
 * `@mysten/deepbook-v3`'s `testnetPools` / `mainnetPools`): testnet ships
 * `SUI_DBUSDC` (test USDC = "DBUSDC"); mainnet ships `SUI_USDC`. The SDK
 * resolves package + object ids per network from these keys, so we only
 * map app-level symbol pairs → the pool that trades them.
 *
 * Flipping the active chain to mainnet is the only change needed to trade
 * `SUI_USDC` instead of `SUI_DBUSDC` — same code path.
 */

import type { SuiNetwork } from "@/services/chains/sui/payloads";

export interface DeepbookPair {
  /** DeepBook pre-registered pool key. */
  poolKey: string;
  /** App symbol of the pool's base coin. */
  baseSymbol: string;
  /** App symbol of the pool's quote coin. */
  quoteSymbol: string;
}

/**
 * Per-network DeepBook pairs. Symbols are app-level ("USDC"), not the
 * DeepBook coin key ("DBUSDC") — the SDK maps the pool's coins itself; we
 * only need the right `poolKey` and which side is base.
 */
export const DEEPBOOK_PAIRS: Record<SuiNetwork, DeepbookPair[]> = {
  testnet: [{ poolKey: "SUI_DBUSDC", baseSymbol: "SUI", quoteSymbol: "USDC" }],
  mainnet: [{ poolKey: "SUI_USDC", baseSymbol: "SUI", quoteSymbol: "USDC" }],
  devnet: [],
};

export type SwapSide = "base->quote" | "quote->base";

export interface ResolvedDeepbookPool {
  poolKey: string;
  side: SwapSide;
}

/** Case-insensitive symbol compare. */
function eq(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Resolve the pool + trade direction for a `from → to` symbol pair on
 * `network`, or `null` when DeepBook has no pool for it.
 */
export function resolveDeepbookPool(
  network: SuiNetwork,
  fromSymbol: string,
  toSymbol: string,
): ResolvedDeepbookPool | null {
  for (const pair of DEEPBOOK_PAIRS[network] ?? []) {
    if (eq(fromSymbol, pair.baseSymbol) && eq(toSymbol, pair.quoteSymbol)) {
      return { poolKey: pair.poolKey, side: "base->quote" };
    }
    if (eq(fromSymbol, pair.quoteSymbol) && eq(toSymbol, pair.baseSymbol)) {
      return { poolKey: pair.poolKey, side: "quote->base" };
    }
  }
  return null;
}
