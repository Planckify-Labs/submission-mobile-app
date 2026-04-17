/**
 * Pure helpers extracted from `ImportSeedPhraseSheet.tsx` so the
 * mnemonic-normalisation, BIP-39 checksum, and duplicate-filter logic
 * can be exercised under the Node test harness (spec §14.6, §14.7,
 * Task 24).
 *
 * Scope:
 *   - `normalizeMnemonic(input)` — trim, collapse internal whitespace
 *     (including newlines/tabs) to single spaces, lowercase. BIP-39
 *     wordlists are lowercase ASCII so a user pasting "ABANDON ABANDON
 *     …" must still validate. No accent normalisation — the English
 *     wordlist is pure ASCII.
 *   - `validateMnemonicState(input)` — returns `"empty"`, `"invalid"`,
 *     or `"valid"` against the English BIP-39 wordlist. Called on blur
 *     by the sheet; cheap enough to rerun per keystroke too, but we
 *     debounce to blur so the field doesn't flash errors mid-typing.
 *   - `filterDuplicates(derived, existing)` — given a freshly-derived
 *     batch and the current wallet bundle, split into `toAdd` (no
 *     collision) and `skipped` (the namespaces that were rejected
 *     because the same `namespace:address` already lives in the
 *     bundle). Case-folding is namespace-scoped: EVM hex is
 *     case-insensitive; Solana base58 is case-sensitive. The simplest
 *     encoding is a `namespace:address` pair key where EVM addresses
 *     are lowered and Solana addresses are preserved verbatim — so
 *     we never silently treat a re-cased Solana key as a dup.
 *
 * Rules (non-negotiable, spec §14.6 / §14.7):
 *   - **BIP-39 check first.** Derivation libs can throw on invalid
 *     input; we validate the checksum before anyone sees a derive
 *     failure.
 *   - **TWV-2026-057 dwell discipline.** These helpers receive the raw
 *     mnemonic string only to validate / normalise it. They never log
 *     it, never stash it in module-level state, and the caller is
 *     responsible for dropping the local reference once derivation
 *     resolves.
 *   - **Node-safe.** No `react` / `react-native` / `viem` imports — the
 *     helpers must load under `node --test --experimental-strip-types`.
 */

import { validateMnemonic } from "@scure/bip39";
import { wordlist as englishWordlist } from "@scure/bip39/wordlists/english";
import type { TWallet } from "../../../constants/types/walletTypes.ts";
import type { Namespace } from "../../../services/chains/types.ts";

export type MnemonicValidationState = "empty" | "invalid" | "valid";

/**
 * Trim, collapse all internal whitespace runs (spaces, tabs, newlines)
 * to single spaces, and lowercase. Returns the normalised string that
 * is safe to feed to `validateMnemonic` and downstream derivation.
 *
 *   `"  ABANDON   ABANDON \n ABOUT  "` → `"abandon abandon about"`
 */
export function normalizeMnemonic(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Three-state validation for the paste textarea.
 *
 *   - `"empty"`   — whitespace-only input; the sheet keeps Next disabled
 *     without showing an error (the field is simply not yet filled).
 *   - `"invalid"` — non-empty but fails the BIP-39 checksum OR the word
 *     count isn't 12 / 24. We lean on `@scure/bip39::validateMnemonic`
 *     for both checks — it rejects wrong-length inputs.
 *   - `"valid"`   — 12 or 24 words, all on the English wordlist, and
 *     checksum matches.
 *
 * Accepts raw user input; internally normalises so callers can pass the
 * unedited textarea string.
 */
export function validateMnemonicState(input: string): MnemonicValidationState {
  const normalised = normalizeMnemonic(input);
  if (normalised.length === 0) return "empty";
  return validateMnemonic(normalised, englishWordlist) ? "valid" : "invalid";
}

/**
 * Build the case-folded dedup key for a wallet. EVM hex addresses are
 * case-insensitive (EIP-55 checksum is a display-only concern), so we
 * lower them to avoid false negatives when one side was serialised with
 * a checksum and the other wasn't. Solana base58 is case-sensitive —
 * `1` vs `l` and `0` vs `O` are distinct and must remain so.
 */
function dedupKey(namespace: Namespace, address: string): string {
  const folded = namespace === "eip155" ? address.toLowerCase() : address;
  return `${namespace}:${folded}`;
}

export interface FilterDuplicatesResult {
  /** Wallets not already present in `existing` — safe to persist. */
  toAdd: TWallet[];
  /**
   * Namespaces from `derived` that collided with an existing wallet.
   * Preserves input order so the UI banner reads deterministically
   * (e.g. `"Already imported: Ethereum"` before `"Solana"` when both
   * chains collide).
   */
  skipped: Namespace[];
}

/**
 * Partition a freshly-derived batch against the current wallet bundle.
 *
 *   - Compares by `namespace:address` pair (EVM lowered, Solana
 *     verbatim — see `dedupKey`).
 *   - Preserves `derived` order in `toAdd`.
 *   - Preserves `derived` order in `skipped` so the banner reads the
 *     same way the namespace list was presented on the picker.
 *
 * Non-goals:
 *   - Does NOT validate the `derived` wallets themselves — callers are
 *     expected to pass the output of `deriveWalletsFromMnemonic`.
 *   - Does NOT mutate either input array.
 */
export function filterDuplicates(
  derived: TWallet[],
  existing: TWallet[],
): FilterDuplicatesResult {
  const existingKeys = new Set(
    existing.map((w) => dedupKey(w.namespace, w.address)),
  );
  const toAdd: TWallet[] = [];
  const skipped: Namespace[] = [];
  for (const w of derived) {
    const key = dedupKey(w.namespace, w.address);
    if (existingKeys.has(key)) {
      skipped.push(w.namespace);
    } else {
      toAdd.push(w);
    }
  }
  return { toAdd, skipped };
}
