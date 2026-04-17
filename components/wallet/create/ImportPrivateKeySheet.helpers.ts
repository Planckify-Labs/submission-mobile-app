/**
 * Pure helpers extracted from `ImportPrivateKeySheet.tsx` so they can be
 * unit-tested under the Node test harness without a React Native renderer
 * (spec §14.6, Task 25).
 *
 * Scope:
 *   - `normalizePrivateKeyInput(input, namespace)` — trim whitespace and
 *     strip an optional `0x` prefix for `eip155`. Solana inputs are only
 *     trimmed — base58 has no prefix convention and silently stripping
 *     characters could flip a valid key to an invalid one.
 *   - `computeValidationState(input, namespace)` — returns `"empty"`,
 *     `"invalid"`, or `"valid"` by routing to the registered kit's
 *     `validatePrivateKey`. Deliberately no `"unknown"` state: the sheet
 *     only enters step 2 after a chain pick, so `namespace === null` is
 *     just a defensive fall-through that maps to `"empty"`.
 *
 * Rules (non-negotiable, spec §14.6):
 *   - No cross-chain derivation: an EVM hex key must not pass as Solana.
 *     The chain-specific validators (via `walletKitRegistry`) already
 *     enforce this — this helper just threads the pick through.
 *   - Paste-UX niceties: trim + strip `0x`, but NEVER re-encode. The
 *     returned string is what the kit later sees verbatim.
 *
 * Node-safe: no `react` / `react-native` / `viem` imports.
 */

import type { Namespace } from "../../../services/chains/types.ts";
import { walletKitRegistry } from "../../../services/walletKit/registry.ts";

export type ValidationState = "empty" | "invalid" | "valid";

/**
 * Trim whitespace and strip an optional `0x` prefix for `eip155`. For any
 * other namespace the input is only trimmed — we do not silently re-encode
 * base58 (or any future exotic encoding) lest a user-visible string drift
 * from what the kit later sees.
 */
export function normalizePrivateKeyInput(
  input: string,
  namespace: Namespace,
): string {
  const trimmed = input.trim();
  if (namespace === "eip155") {
    return trimmed.startsWith("0x") || trimmed.startsWith("0X")
      ? trimmed.slice(2)
      : trimmed;
  }
  return trimmed;
}

/**
 * Returns the three-state validation result for a raw paste-field value.
 *
 * - `"empty"`: whitespace-only input OR missing namespace (defensive).
 * - `"invalid"`: non-empty input rejected by the registered kit's
 *   `validatePrivateKey` — e.g. a 64-hex EVM key forced into the Solana
 *   path fails the `solana` kit's base58 length check and returns here.
 * - `"valid"`: kit accepts the normalized input.
 *
 * No debouncing concerns: the function is O(1) in practice (regex +
 * optional base58 decode), and the caller is free to debounce UI
 * feedback.
 */
export function computeValidationState(
  input: string,
  namespace: Namespace | null,
): ValidationState {
  if (!namespace) return "empty";
  const normalized = normalizePrivateKeyInput(input, namespace);
  if (normalized.length === 0) return "empty";
  const kit = walletKitRegistry.get(namespace);
  // For eip155 the canonical kit validator accepts with or without `0x`,
  // so passing `normalized` (already-stripped) still works. We don't
  // re-add the prefix here because that would silently re-encode.
  return kit.validatePrivateKey(normalized) ? "valid" : "invalid";
}
