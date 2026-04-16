/**
 * Deterministic spam detection for tokens.
 * Heuristic-based — no randomness, no network calls.
 */

import type { TokenBalance } from "@/services/indexer/types";
import { TOP_100_NAMES } from "./tokenList";
import type { SpamCheckResult } from "./types";

// ─── Levenshtein Distance ────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, () =>
    Array(lb + 1).fill(0),
  );

  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[la][lb];
}

// ─── Known legitimate variants (should NOT be flagged) ──────────────

const LEGITIMATE_VARIANTS = new Set([
  "usdc.e",
  "usdt.e",
  "dai.e",
  "weth.e",
  "wbtc.e",
  "usdc (pos)",
  "usdc (bridged)",
  "bridged usdc",
]);

// ─── Spam Check ──────────────────────────────────────────────────────

export function checkSpam(token: TokenBalance): SpamCheckResult {
  // 1. Indexer-side spam flag passthrough
  if (token.isSpam) {
    return { isSpam: true, reason: "Flagged by indexer", severity: "danger" };
  }

  // 2. No logo + zero balance + auto-discovered → likely airdrop spam
  if (
    !token.logoURI &&
    token.balance === 0n &&
    token.source === "auto-discovered"
  ) {
    return {
      isSpam: true,
      reason: "Zero-value airdrop with no verified logo",
      severity: "warn",
    };
  }

  // 3. Token name mimics known token (Levenshtein)
  const nameCheck = checkNameMimicry(token.name, token.symbol);
  if (nameCheck) return nameCheck;

  return { isSpam: false, severity: "safe" };
}

function checkNameMimicry(
  name: string,
  symbol: string,
): SpamCheckResult | null {
  const lowerName = name.toLowerCase().trim();
  const lowerSymbol = symbol.toLowerCase().trim();

  // Skip check for legitimate variants
  if (
    LEGITIMATE_VARIANTS.has(lowerName) ||
    LEGITIMATE_VARIANTS.has(lowerSymbol)
  ) {
    return null;
  }

  for (const knownName of TOP_100_NAMES) {
    const known = knownName.toLowerCase();

    // Exact match is fine — it IS the token (or the default list includes it)
    if (lowerName === known || lowerSymbol === known) continue;

    // Check Levenshtein distance
    const nameDistance = levenshtein(lowerName, known);
    const symbolDistance = levenshtein(lowerSymbol, known);

    // Distance < 3 but not 0 → suspicious mimic
    if (
      (nameDistance > 0 && nameDistance < 3 && lowerName.length > 2) ||
      (symbolDistance > 0 && symbolDistance < 3 && lowerSymbol.length > 2)
    ) {
      return {
        isSpam: false, // Not auto-hidden, but warned
        reason: `Name similar to "${knownName}"`,
        severity: "warn",
      };
    }
  }

  return null;
}

/**
 * Batch check an array of tokens.
 */
export function checkSpamBatch(
  tokens: TokenBalance[],
): Map<string, SpamCheckResult> {
  const results = new Map<string, SpamCheckResult>();
  for (const token of tokens) {
    const key = `${token.contractAddress.toLowerCase()}:${token.chainId}`;
    results.set(key, checkSpam(token));
  }
  return results;
}
