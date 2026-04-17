/**
 * Pure helpers for `AddWalletSheet.tsx` (spec §14.5).
 *
 * Extracted so the picker-state logic can be exercised by the Node test
 * harness — `AddWalletSheet.tsx` itself imports `react-native` and is
 * therefore not Node-loadable.
 *
 * Contract:
 *   - `computeStepFromSelection` maps a user selection (or `null`, which
 *     means "no card tapped yet") to the 4-value step union the sheet
 *     renders. A trivial passthrough, but pinned behind a helper so the
 *     rendering contract is tested in one place.
 *   - `shouldResetOnVisibleChange` encodes the "re-open always lands on
 *     the picker" rule (spec §14.5: "Close wipes state"). When the sheet
 *     transitions from hidden → visible, the caller resets `step` to
 *     `"picker"`. The helper collapses the boolean edge-detect logic so
 *     the component stays declarative.
 *
 * Rules:
 *   - No `react` / `react-native` imports — Node-loadable.
 *   - Helpers are pure — no module-level state, no side effects.
 */

export type AddWalletSelection = "create" | "seed" | "pk" | null;
export type AddWalletStep = "picker" | "create" | "seed" | "pk";

/**
 * Convert a user picker selection into the sheet's `step` value.
 *
 * `null` (nothing tapped) → `"picker"`. Otherwise the selection name
 * doubles as the step name. Kept as a helper so the mapping has a
 * single test target; the component reaches for it rather than
 * inlining `selected ?? "picker"`.
 */
export function computeStepFromSelection(
  selected: AddWalletSelection,
): AddWalletStep {
  if (selected === null) return "picker";
  return selected;
}

/**
 * Edge detect: did `visible` just go from `false` to `true`?
 *
 * The sheet watches its `visible` prop and resets the step to
 * `"picker"` on every fresh open so re-entering never lands mid-flow
 * (spec §14.5 close-wipes-state rule). This helper isolates that
 * predicate so the component's `useEffect` body stays a one-liner.
 */
export function shouldResetOnVisibleChange(
  prevVisible: boolean,
  nextVisible: boolean,
): boolean {
  return nextVisible === true && prevVisible === false;
}

/**
 * Reducer for the "switch to seed import from inside the private-key
 * sub-sheet" handoff. `ImportPrivateKeySheet` receives an optional
 * `onImportSeedPhraseInstead` callback; when present, tapping the
 * footer link should leave the PK flow and land on the seed flow.
 *
 * The sub-sheets render mutually exclusively (see `AddWalletSheet.tsx`
 * — only one modal is mounted at a time), so the pivot is just a step
 * swap from the parent's perspective. Encoded as a helper so the
 * wiring is testable without mounting a RN tree.
 */
export function reducerOnImportSeedPhraseInstead(
  prev: AddWalletStep,
): AddWalletStep {
  // Only legal from the `"pk"` step — any other caller would be a
  // wiring bug. We fail-safe by not touching the step, so the UI
  // doesn't jump if the reducer is invoked from an unexpected place.
  if (prev !== "pk") return prev;
  return "seed";
}
