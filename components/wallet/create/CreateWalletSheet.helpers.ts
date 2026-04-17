/**
 * Pure logic helpers extracted from `CreateWalletSheet.tsx` (spec §14.6).
 *
 * These helpers are the only parts of the sheet that are testable under
 * the Node test harness — the component itself renders `react-native`
 * and cannot be loaded outside Metro without a full RN renderer (see
 * `computeNextSelection.ts` header for the same rationale).
 *
 * Contract:
 *   - `shuffleWords` accepts an optional deterministic `rng` so tests
 *     can assert stable shuffle output. Runtime callers rely on the
 *     default `Math.random` and must NEVER use the output in any
 *     cryptographic context. Mnemonic generation itself flows through
 *     `generateWalletMnemonic` (TWV-2026-002 CSPRNG) — this helper is
 *     only about UI ordering.
 *   - `verifyWords` returns a tri-state so callers can distinguish
 *     "still picking" (`incomplete`) from "tried and wrong" (`incorrect`)
 *     without overloading a boolean.
 *   - `computeStep` is a deterministic reducer: from the current
 *     in-flight state, which 1-based step should the sheet render?
 *     Used both by the component to drive rendering and by tests to
 *     pin the step-transition contract.
 *
 * Rules:
 *   - No `react` / `react-native` / `viem` imports — Node-loadable.
 *   - NEVER log or persist the mnemonic (TWV-2026-057 dwell discipline).
 *     The helpers receive mnemonic words only to shuffle / compare and
 *     must not stash them in module-level state.
 */

import type { Namespace } from "@/services/chains/types";

export type VerifyResult = "incomplete" | "correct" | "incorrect";

/**
 * Return a shuffled copy of `words`. A deterministic RNG can be injected
 * so tests can assert exact output; the default `Math.random` is used
 * in production for pick-order shuffling only — never for entropy.
 *
 * Implementation: Fisher–Yates. Input array is not mutated.
 */
export function shuffleWords(
  words: string[],
  rng: () => number = Math.random,
): string[] {
  const out = words.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Verify that the user has picked words in the correct order from the
 * `shuffled` list. `pickedIndices[i]` is the position in `shuffled` the
 * user selected as the i-th word of `answer`.
 *
 *   - `incomplete` — `pickedIndices.length < answer.length`, the user
 *     has not yet picked every word.
 *   - `correct`    — exactly `answer.length` picks and every picked
 *     word matches `answer` in order.
 *   - `incorrect`  — every pick made, but at least one mismatches.
 *
 * Indices out of range of `shuffled` count as mismatches (fail closed).
 * Duplicate picks are permitted in the input but will only register as
 * correct if the shuffled list also contains the expected duplicate —
 * mirroring the `WalletSetup.tsx` UX where each slot is an independent
 * row of chips.
 */
export function verifyWords(
  shuffled: string[],
  pickedIndices: number[],
  answer: string[],
): VerifyResult {
  if (pickedIndices.length < answer.length) return "incomplete";
  for (let i = 0; i < answer.length; i++) {
    const idx = pickedIndices[i];
    if (idx < 0 || idx >= shuffled.length) return "incorrect";
    if (shuffled[idx] !== answer[i]) return "incorrect";
  }
  return "correct";
}

export interface StepState {
  /** True once the user has tapped "I've written them down" on step 1. */
  mnemonicAcknowledged: boolean;
  /** Verification outcome for step 2. */
  verifyState: VerifyResult;
  /**
   * True once the user has tapped "Confirm" on step 2 with a correct
   * `verifyState`. Splitting the "picked all correctly" moment from the
   * "committed to advance" moment keeps the UX explicit — the sheet
   * won't silently skip to namespaces the instant the last word is
   * tapped.
   */
  verifyConfirmed: boolean;
  /** True once the user has confirmed the namespace multi-select. */
  namespacesConfirmed: boolean;
  /** True while the async derive + save mutation is running. */
  isSaving: boolean;
  /** True once `addWallets` has resolved successfully. */
  completed: boolean;
}

/**
 * Deterministic step reducer — maps an in-flight `StepState` to the
 * 1-based step number the sheet should render:
 *
 *   1 — Generate & display mnemonic
 *   2 — Verify words
 *   3 — Namespace multi-select
 *   4 — Confirm (async save in progress / success screen)
 *
 * Transitions happen in the component via explicit next-button taps;
 * this helper is the single source of truth for "given state X, which
 * step am I on?" so rendering logic stays declarative.
 */
export function computeStep(state: StepState): 1 | 2 | 3 | 4 {
  if (state.completed || state.isSaving) return 4;
  if (state.namespacesConfirmed) return 4;
  if (state.verifyConfirmed) return 3;
  if (state.mnemonicAcknowledged) return 2;
  return 1;
}

/**
 * Equality helper for namespace arrays — used by the sheet to detect
 * "user changed the default all-checked selection" without importing
 * lodash. Order-independent because the picker preserves registry
 * insertion order but the comparison is conceptually set-based.
 */
export function namespaceSetsEqual(a: Namespace[], b: Namespace[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const ns of b) if (!sa.has(ns)) return false;
  return true;
}
