/**
 * Swap venue selection (spec §4.6.1) — priority-ordered, quote-aware, the
 * same pattern the x402 settlement-rail chain uses: try venues in priority
 * order for the active network, drop those that error / return no route,
 * and let the best expected-out win (ties → earlier priority).
 *
 * Adding or reordering a swap venue is a one-line edit to `SWAP_PRIORITY`;
 * no change to the compiler, guardian, tools, or UI (space-docking).
 */

import type { SuiNetwork } from "@/services/chains/sui/payloads";
import {
  SuiSwapError,
  type SuiSwapRoute,
  type SuiSwapRouteParams,
  type SuiSwapVenue,
} from "./types";
import { cetusSwapVenue } from "./venues/cetusSwap";
import { deepbookSwapVenue } from "./venues/deepbookSwap";
import { sevenkSwapVenue } from "./venues/sevenkSwap";

/** Aggregators first (best route), DeepBook CLOB as the fallback. */
export const SWAP_PRIORITY: Record<SuiNetwork, string[]> = {
  mainnet: ["cetus", "7k", "deepbook"],
  testnet: ["deepbook"], // only DeepBook runs on testnet
  devnet: ["deepbook"],
};

export const DEFAULT_SWAP_VENUES: SuiSwapVenue[] = [
  deepbookSwapVenue,
  cetusSwapVenue,
  sevenkSwapVenue,
];

/**
 * Walk `SWAP_PRIORITY` for the active network, quote each registered venue
 * that supports it, and return the best-expected-out route. Returns `null`
 * when no venue answers (the router maps that to `no_swap_route`). The
 * `venues` arg is injectable for unit tests.
 *
 * If a venue throws a typed `SuiSwapError` (an actionable reason such as
 * `amount_below_minimum`) and NO venue ultimately produces a route, that
 * reason is re-thrown instead of collapsing to a generic `no_swap_route` —
 * so the user gets a precise message. Plain (untyped) throws are swallowed.
 */
export async function selectSwapRoute(
  params: SuiSwapRouteParams,
  venues: SuiSwapVenue[] = DEFAULT_SWAP_VENUES,
): Promise<SuiSwapRoute | null> {
  const network = params.chain.network;
  const priority = SWAP_PRIORITY[network] ?? [];
  const byId = new Map(venues.map((v) => [v.id, v]));

  const candidates: SuiSwapRoute[] = [];
  let firstReason: SuiSwapError | null = null;
  for (const id of priority) {
    const venue = byId.get(id);
    if (!venue || !venue.supports(network)) continue;
    try {
      const route = await venue.getRoute(params);
      if (route && route.expectedOut > 0n) candidates.push(route);
    } catch (err) {
      // Keep the first actionable reason; surface it only if no route wins.
      if (err instanceof SuiSwapError && !firstReason) firstReason = err;
      // Other throws are skipped — same as returning no route.
    }
  }

  // Iterating in priority order + replacing only on strictly-greater means
  // ties resolve to the earlier-priority venue.
  let best: SuiSwapRoute | null = null;
  for (const c of candidates) {
    if (!best || c.expectedOut > best.expectedOut) best = c;
  }
  if (!best && firstReason) throw firstReason;
  return best;
}
