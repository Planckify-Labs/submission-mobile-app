/**
 * Scallop coin config (spec §4.4). Maps app-level asset symbols → the
 * Scallop SDK `poolCoinName` + decimals. Scallop resolves package/object
 * ids per network from its own address service, so we only need the coin
 * name the `depositQuick`/`withdrawQuick` builders expect.
 *
 * Mainnet-only — Scallop ships no testnet addresses (§4.4). An asset not
 * listed here is rejected with `DefiError("unsupported_asset")`.
 */

export interface ScallopCoin {
  /** Scallop SDK pool coin name (e.g. "usdc"). */
  coinName: string;
  decimals: number;
}

/** App symbol (upper-case) → Scallop coin. Extend as Scallop lists more. */
export const SCALLOP_COINS: Record<string, ScallopCoin> = {
  USDC: { coinName: "usdc", decimals: 6 },
  USDT: { coinName: "usdt", decimals: 6 },
  SUI: { coinName: "sui", decimals: 9 },
};

export function resolveScallopCoin(symbol: string): ScallopCoin | null {
  return SCALLOP_COINS[symbol.toUpperCase()] ?? null;
}
