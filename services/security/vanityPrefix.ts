/**
 * TWV-2026-040 — Vanity-prefix risk check at wallet import.
 *
 * Runs offline against the in-bundle heuristic list
 * (`constants/vanity-prefix-patterns.ts`). Returns a flagged result
 * when an address' hex layout matches a pattern consistent with a
 * Profanity-class generator (32-bit seed, brute-forceable on consumer
 * GPUs).
 *
 * Consumers: every wallet-import path (seed-phrase, private-key,
 * social). On flag, the UI MUST show a non-dismissible warning screen
 * and require explicit checkbox acknowledgement before the import
 * finalises.
 *
 * Pre-implementation note — TWV-2026-040 + TWV-2026-002:
 * If a "choose your address prefix" feature is ever built in Takumi,
 * every attempt MUST sample entropy from the OS CSPRNG
 * (`expo-crypto` `getRandomBytesAsync(32)` or equivalent) — NEVER
 * seed-roll a PRNG, NEVER reuse a single random seed across attempts,
 * NEVER use `Math.random`. Profanity's 32-bit seed is precisely the
 * compromise mode this rule defends against. See TWV-2026-002 for
 * the entropy-source rule; that rule extends here without modification.
 */

import {
  VANITY_PATTERNS,
  type VanityPattern,
  type VanityReason,
} from "../../constants/vanity-prefix-patterns.ts";

export interface VanityPrefixRiskResult {
  /** False when the address passed every heuristic. */
  flagged: boolean;
  /** The first pattern that matched (if any). */
  reason?: VanityReason;
  /** Human-readable copy for the warning modal. */
  description?: string;
}

const LEARN_MORE_URL =
  "https://medium.com/wintermute-trading/wintermute-hack-recovery-d36b7ad5a63c";

export const VANITY_LEARN_MORE_URL = LEARN_MORE_URL;

/**
 * Check whether an address' hex layout matches a known-brute-forceable
 * vanity-generator class. Offline, deterministic, order-independent.
 *
 * False positives are acceptable (per TWV-2026-040 rules — a legitimate
 * address that happens to have many leading zeros still deserves the
 * warning because the user should understand the risk before relying on
 * it for custody). False negatives are not; err on the side of
 * flagging.
 */
export function checkVanityPrefixRisk(
  address: string | undefined | null,
): VanityPrefixRiskResult {
  if (!address) return { flagged: false };
  const normalized = address.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) {
    // Not a 20-byte EVM address — the heuristic does not apply.
    return { flagged: false };
  }
  for (const pattern of VANITY_PATTERNS) {
    if (pattern.regex.test(normalized)) {
      return {
        flagged: true,
        reason: pattern.reason,
        description: pattern.description,
      };
    }
  }
  return { flagged: false };
}

export const __testing = {
  VANITY_PATTERNS: VANITY_PATTERNS as readonly VanityPattern[],
};
