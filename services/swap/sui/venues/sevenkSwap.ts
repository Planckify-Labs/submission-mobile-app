/**
 * 7K Meta-Aggregator swap venue (spec §4.5) — MAINNET-ONLY, second in the
 * mainnet swap priority (drop-in alternative aggregator).
 *
 * SDK: `@7kprotocol/sdk-ts` — Meta-Aggregator quote + tx build (same
 * quote+build shape as Cetus).
 *
 * Status — wiring deferred pending live mainnet validation (spec §14.1 /
 * §14.4 open questions): the SDK exposes its quote/build entry points
 * through a client surface that must be exercised on mainnet (README: "this
 * package only supports mainnet"), with no testnet deployment to validate
 * against. Until then this venue returns `null`, so `venueSelector` falls
 * through to DeepBook. The SDK is installed; this is the single place to
 * wire the 7K quote+build for the mainnet flip.
 */

import type { SuiNetwork } from "@/services/chains/sui/payloads";
import type { SuiSwapRoute, SuiSwapRouteParams, SuiSwapVenue } from "../types";

export const sevenkSwapVenue: SuiSwapVenue = {
  id: "7k",

  supports(network: SuiNetwork): boolean {
    return network === "mainnet";
  },

  async getRoute(_params: SuiSwapRouteParams): Promise<SuiSwapRoute | null> {
    // Deferred — see file header. Null hands the swap to the next venue.
    return null;
  },
};
