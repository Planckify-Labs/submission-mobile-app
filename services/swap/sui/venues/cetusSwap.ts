/**
 * Cetus aggregator swap venue (spec §4.5) — MAINNET-ONLY, first in the
 * mainnet swap priority (best-route aggregator).
 *
 * SDK: `@cetusprotocol/aggregator-sdk` — `new AggregatorClient(...)`, then
 * `findRouters({ from, target, amount, byAmountIn })` (→ `{ amountOut,
 * priceImpact }`, the guardian's numbers) and `fastRouterSwap({ routers,
 * txb, slippage })` to append the swap to a `Transaction`.
 *
 * Status — wiring deferred pending live mainnet validation (spec §14.1 /
 * §14.4 open questions): the SDK's `AggregatorClient` requires a
 * `SuiGrpcClient` and `bn.js` `BN` amounts, and there is no testnet
 * deployment to validate the built PTB against. Until that validation runs
 * on mainnet with a small real amount, this venue returns `null` (no
 * route), so `venueSelector` cleanly falls through to DeepBook — exactly
 * the priority-ordered, fail-safe behaviour the selector is built for. The
 * SDK is installed and the entry points above are the wiring surface; this
 * is the one place to fill in for the mainnet flip, with no change to the
 * compiler, guardian, tools, or UI.
 */

import type { SuiNetwork } from "@/services/chains/sui/payloads";
import type { SuiSwapRoute, SuiSwapRouteParams, SuiSwapVenue } from "../types";

export const cetusSwapVenue: SuiSwapVenue = {
  id: "cetus",

  supports(network: SuiNetwork): boolean {
    return network === "mainnet";
  },

  async getRoute(_params: SuiSwapRouteParams): Promise<SuiSwapRoute | null> {
    // Deferred — see file header. Returning null hands the swap to the
    // next venue in SWAP_PRIORITY (DeepBook), so mainnet swaps still work.
    return null;
  },
};
