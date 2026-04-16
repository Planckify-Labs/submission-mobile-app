// TWV-2026-038 — Claim-label vs simulated-delta mismatch detector.
//
// Penpie ($27M, Sep 2024) and several drainer waves abuse the user's
// reflex of treating "claim rewards" as a one-tap, low-risk action.
// The defence: when the dApp / decoded calldata claims this is a
// `claim` / `harvest` / `collect` / `redeem`, but the simulated net
// asset delta is non-positive, raise a red banner and require a
// secondary tap.
//
// Pure logic — wired into the signer UI on top of `txSimulator.ts`'s
// asset-delta output.

import type { AssetDelta } from "./txSimulator.ts";

// Matches the verb at a word boundary on the left and either a word
// boundary or a camelCase capital letter on the right — so `claim`,
// `claim rewards`, and `claimRewards` all hit, while `proclaim` does not.
export const CLAIM_LABEL_RE = /\b(claim|harvest|collect|redeem)(\b|[A-Z])/i;

export interface ClaimMismatchInput {
  /** dApp-supplied tx title / description, if present. */
  dappLabel?: string;
  /** Top-level decoded function name, if available. */
  functionName?: string;
  /** Output of `predictAssetDeltasFromCalldata` / full simulator. */
  deltas: AssetDelta[];
}

export interface ClaimMismatchVerdict {
  triggered: boolean;
  /** Why — for the UI banner copy. */
  reason?: string;
}

/**
 * True iff label set looks like a claim flow. Function name takes
 * precedence over dApp-supplied text per the spec ("never trust dApp
 * text alone").
 */
export function looksLikeClaim(input: {
  dappLabel?: string;
  functionName?: string;
}): boolean {
  if (input.functionName && CLAIM_LABEL_RE.test(input.functionName))
    return true;
  if (input.dappLabel && CLAIM_LABEL_RE.test(input.dappLabel)) return true;
  return false;
}

/**
 * The user's net inflow per the predicted deltas. `in` adds, `out`
 * subtracts. "unlimited" out-flows are treated as "definitely not a
 * positive claim" — return -1 sentinel-shaped result.
 */
function netInflow(deltas: AssetDelta[]): bigint | "negative_infinity" {
  let net = 0n;
  for (const d of deltas) {
    if (d.amount === "unlimited") {
      if (d.direction === "out") return "negative_infinity";
      // "unlimited in" never happens in practice; treat as zero.
      continue;
    }
    if (d.direction === "in") net += d.amount;
    else net -= d.amount;
  }
  return net;
}

export function detectClaimMismatch(
  input: ClaimMismatchInput,
): ClaimMismatchVerdict {
  if (!looksLikeClaim(input)) return { triggered: false };

  const net = netInflow(input.deltas);
  if (net === "negative_infinity") {
    return {
      triggered: true,
      reason:
        "Claim flow grants the contract unlimited outbound permission — drainers exploit this. Proceed only if you are sure.",
    };
  }
  if (net <= 0n) {
    return {
      triggered: true,
      reason:
        "Claim flow with no net inflow — the simulator predicts you receive nothing. Proceed only if you are sure.",
    };
  }
  return { triggered: false };
}
