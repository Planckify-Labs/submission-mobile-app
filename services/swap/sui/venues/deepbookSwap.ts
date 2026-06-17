/**
 * DeepBook v3 swap venue (spec §4.5) — testnet + mainnet, the baseline and
 * the only testnet-capable DEX.
 *
 * Uses `@mysten/deepbook-v3`: `getQuoteQuantityOut` / `getBaseQuantityOut`
 * for the pre-build quote (→ `expectedOut` + `priceImpact` for the
 * guardian), then `swapExactBaseForQuote` / `swapExactQuoteForBase` to
 * append the swap to a `Transaction`, transferring the output coins back to
 * the sender. The SDK works in DECIMAL amounts (it scales by each coin's
 * `scalar`), so we hand it the human amount and convert the quoted output
 * to raw units for the route.
 *
 * The SDK is dynamically imported so its (and Pyth's) module graph never
 * loads at app boot — only when a swap actually runs (the
 * `recordTransferHistory` precedent). Any inability to quote/build returns
 * `null` so the selector falls through to another venue or reports
 * `no_swap_route`; it never crashes the preview.
 *
 * DEEP fees: we pass `deepAmount: 0`. Whitelisted / input-fee pools (the
 * testnet `SUI_DBUSDC` baseline) need no DEEP; if a pool genuinely requires
 * DEEP the dry-run reverts and the guardian blocks with a plain-language
 * "this would fail on-chain" — never a silent bad sign.
 */

import { toBase64 } from "@mysten/bcs";
import type {
  CoinMap,
  DeepBookClient,
  DeepBookCompatibleClient,
  PoolMap,
} from "@mysten/deepbook-v3";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { parseUnits } from "viem";
import type { SuiNetwork } from "@/services/chains/sui/payloads";
import { resolveDeepbookPool } from "../deepbook.config";
import {
  SuiSwapError,
  type SuiSwapRoute,
  type SuiSwapRouteParams,
  type SuiSwapVenue,
} from "../types";

/**
 * Output-coin metadata resolved from DeepBook's OWN config (the DEX is the
 * source of truth for the coins its pools trade — see CLAUDE.md / the
 * token-config-is-API-driven rule: we never hardcode decimals in the app,
 * and we never require the user to hold / have a registry row for the coin
 * they're swapping INTO). `scalar` is 10^decimals.
 */
interface OutputCoinMeta {
  coinType: string;
  decimals: number;
}

function decimalsFromScalar(scalar: number): number {
  if (!Number.isFinite(scalar) || scalar <= 0) return 0;
  return Math.round(Math.log10(scalar));
}

/**
 * Resolve the OUTPUT coin (the side the user receives) for a pool + trade
 * direction, reading the SDK's bundled coin/pool maps. Returns `null` if the
 * pool/coin isn't in the SDK config — the venue then can't honour the route.
 */
function resolveOutputCoin(
  network: SuiSwapRouteParams["chain"]["network"],
  poolKey: string,
  side: "base->quote" | "quote->base",
  pools: PoolMap,
  coins: CoinMap,
): OutputCoinMeta | null {
  const pool = pools[poolKey];
  if (!pool) return null;
  const outKey = side === "base->quote" ? pool.quoteCoin : pool.baseCoin;
  const coin = coins[outKey];
  if (!coin) return null;
  return { coinType: coin.type, decimals: decimalsFromScalar(coin.scalar) };
}

/** Convert a JS decimal number to raw bigint units, rounding down. */
function decimalToRaw(value: number, decimals: number): bigint {
  if (!Number.isFinite(value) || value <= 0) return 0n;
  // `toFixed(decimals)` then `parseUnits` avoids float drift at the
  // chain boundary; rounding down is conservative for an expected-out.
  try {
    return parseUnits(value.toFixed(Math.min(decimals, 18)), decimals);
  } catch {
    return 0n;
  }
}

async function loadDeepBook(
  chain: SuiSwapRouteParams["chain"],
  address: string,
): Promise<{ db: DeepBookClient; coins: CoinMap; pools: PoolMap }> {
  const mod = await import("@mysten/deepbook-v3");
  const suiClient = new SuiJsonRpcClient({
    url: chain.rpcUrl,
    network: chain.network,
  });
  const db = new mod.DeepBookClient({
    // 2.16 vs the SDK's 2.18 peer differ only structurally; the methods
    // DeepBook calls exist on our client. Cast at the single boundary.
    client: suiClient as unknown as DeepBookCompatibleClient,
    address,
    network: chain.network as SuiNetwork,
  });
  // The SDK's bundled coin/pool maps are the source of truth for the coins
  // each pool trades (decimals via `scalar`, Move `type`).
  const isMainnet = chain.network === "mainnet";
  return {
    db,
    coins: isMainnet ? mod.mainnetCoins : mod.testnetCoins,
    pools: isMainnet ? mod.mainnetPools : mod.testnetPools,
  };
}

export const deepbookSwapVenue: SuiSwapVenue = {
  id: "deepbook",

  supports(): boolean {
    // DeepBook runs on testnet and mainnet; devnet has no pools (config gates).
    return true;
  },

  async getRoute(params: SuiSwapRouteParams): Promise<SuiSwapRoute | null> {
    const resolved = resolveDeepbookPool(
      params.chain.network,
      params.fromSymbol,
      params.toSymbol,
    );
    if (!resolved) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn(
          `[deepbookSwap] no pool for ${params.fromSymbol}->${params.toSymbol} on ${params.chain.network}`,
        );
      }
      return null;
    }

    try {
      const { db, coins, pools } = await loadDeepBook(
        params.chain,
        params.wallet.address,
      );
      const amountIn = Number(params.amountHuman);
      if (!Number.isFinite(amountIn) || amountIn <= 0) return null;

      // Output coin (coinType + decimals) from DeepBook's own config — the
      // DEX is authoritative for the pool's coins, so the user never needs a
      // registry row or holdings for the asset they're swapping INTO. If the
      // SDK doesn't describe the pool's coins we skip the venue rather than
      // fabricate decimals (no magic fallbacks — config is authoritative).
      const outMeta = resolveOutputCoin(
        params.chain.network,
        resolved.poolKey,
        resolved.side,
        pools,
        coins,
      );
      if (!outMeta) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn(
            `[deepbookSwap] SDK has no coin metadata for pool ${resolved.poolKey} on ${params.chain.network}`,
          );
        }
        return null;
      }

      // Quote (decimal out) + reference mid price for price impact.
      //
      // Use the INPUT-FEE quote variants: the build below passes
      // `deepAmount: 0`, so DeepBook charges the swap fee from the INPUT coin
      // — the user needs NO DEEP token (the pool is not whitelisted). Quoting
      // with the pay-DEEP variant would mis-state expectedOut/minOut vs. what
      // actually executes and could make a valid swap revert on `minOut`.
      let expectedOutDecimal: number;
      if (resolved.side === "base->quote") {
        const q = await db.getQuoteQuantityOutInputFee(
          resolved.poolKey,
          amountIn,
        );
        expectedOutDecimal = q.quoteOut;
      } else {
        const q = await db.getBaseQuantityOutInputFee(
          resolved.poolKey,
          amountIn,
        );
        expectedOutDecimal = q.baseOut;
      }
      if (!Number.isFinite(expectedOutDecimal) || expectedOutDecimal <= 0) {
        // A zero fill on a pool that HAS liquidity means the amount is below
        // the pool's *usable* minimum. NOTE the input fee is taken FROM the
        // input, so the effective minimum sits a bit ABOVE the raw on-chain
        // minSize + lot rounding — e.g. on minSize-1 SUI_DBUSDC, 1.0 SUI
        // yields 0 (fee+lot push it under 1.0) while ~1.1 fills. So we can't
        // gate on `amountIn < minSize`; instead, a 0 fill while the book has
        // liquidity IS the actionable "amount below minimum" case. Only a
        // genuinely empty/priceless book is a real no-route (→ null).
        let minSize: number | undefined;
        try {
          minSize = (await db.poolBookParams(resolved.poolKey)).minSize;
        } catch {
          minSize = undefined;
        }
        let hasLiquidity = false;
        try {
          const mid = await db.midPrice(resolved.poolKey);
          hasLiquidity = Number.isFinite(mid) && mid > 0;
        } catch {
          hasLiquidity = false;
        }
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn(
            `[deepbookSwap] ${resolved.poolKey}: 0 output for ${amountIn} ${params.fromSymbol} (minSize ${minSize ?? "?"}, liquidity ${hasLiquidity})`,
          );
        }
        if (hasLiquidity) {
          throw new SuiSwapError(
            "amount_below_minimum",
            minSize !== undefined
              ? `min ~${minSize} ${params.fromSymbol} (after fee)`
              : undefined,
          );
        }
        return null;
      }

      const priceImpact = await computePriceImpact(
        db,
        resolved.poolKey,
        resolved.side,
        amountIn,
        expectedOutDecimal,
      );

      const minOutDecimal =
        expectedOutDecimal * (1 - params.maxSlippageBps / 10_000);

      const tx = new Transaction();
      tx.setSender(params.wallet.address);
      const swapArgs = {
        poolKey: resolved.poolKey,
        amount: amountIn,
        deepAmount: 0,
        minOut: minOutDecimal,
      };
      const results =
        resolved.side === "base->quote"
          ? db.deepBook.swapExactBaseForQuote(swapArgs)(tx)
          : db.deepBook.swapExactQuoteForBase(swapArgs)(tx);
      // [baseOut, quoteOut, deepOut] — sweep all three back to the user.
      tx.transferObjects([...results], tx.pure.address(params.wallet.address));

      const bytes = await tx.build({
        client: new SuiJsonRpcClient({
          url: params.chain.rpcUrl,
          network: params.chain.network,
        }),
      });

      let poolObjectId: string | undefined;
      try {
        poolObjectId = await db.poolId(resolved.poolKey);
      } catch {
        poolObjectId = undefined;
      }

      return {
        venue: this.id,
        ptbBase64: toBase64(bytes),
        expectedOut: decimalToRaw(expectedOutDecimal, outMeta.decimals),
        priceImpact,
        poolObjectId,
        fromCoinType: params.fromCoinType,
        toCoinType: outMeta.coinType,
      };
    } catch (err) {
      // A typed, actionable reason (e.g. amount_below_minimum) must reach the
      // selector — re-throw it. Any other quote/build failure is a plain skip
      // (selector reports no_swap_route if no venue answers); surface the real
      // SDK reason in dev logs ONLY (CLAUDE.md user-facing-errors).
      if (err instanceof SuiSwapError) throw err;
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn(
          `[deepbookSwap] route failed for ${params.fromSymbol}->${params.toSymbol} on ${params.chain.network}:`,
          err,
        );
      }
      return null;
    }
  },
};

/**
 * Price impact ≈ (referenceOut − expectedOut) / referenceOut, where the
 * reference is the swap valued at the pool's mid price. Returns 0 when the
 * mid price is unavailable (the on-chain `minOut` is still enforced).
 */
async function computePriceImpact(
  db: DeepBookClient,
  poolKey: string,
  side: "base->quote" | "quote->base",
  amountIn: number,
  expectedOut: number,
): Promise<number> {
  try {
    const mid = await db.midPrice(poolKey); // quote per base
    if (!Number.isFinite(mid) || mid <= 0) return 0;
    const referenceOut =
      side === "base->quote" ? amountIn * mid : amountIn / mid;
    if (!Number.isFinite(referenceOut) || referenceOut <= 0) return 0;
    const impact = (referenceOut - expectedOut) / referenceOut;
    return impact > 0 ? impact : 0;
  } catch {
    return 0;
  }
}
