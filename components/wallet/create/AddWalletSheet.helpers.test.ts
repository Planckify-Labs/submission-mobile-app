/**
 * Unit tests for `AddWalletSheet.helpers` — the picker-state logic for
 * the top-level "Add wallet" sheet (spec §14.5).
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     components/wallet/create/AddWalletSheet.helpers.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeStepFromSelection,
  reducerOnImportSeedPhraseInstead,
  shouldResetOnVisibleChange,
} from "./AddWalletSheet.helpers.ts";

describe("computeStepFromSelection", () => {
  it("returns 'picker' for a null selection", () => {
    assert.equal(computeStepFromSelection(null), "picker");
  });

  it("returns 'create' when 'create' is selected", () => {
    assert.equal(computeStepFromSelection("create"), "create");
  });

  it("returns 'seed' when 'seed' is selected", () => {
    assert.equal(computeStepFromSelection("seed"), "seed");
  });

  it("returns 'pk' when 'pk' is selected", () => {
    assert.equal(computeStepFromSelection("pk"), "pk");
  });
});

describe("shouldResetOnVisibleChange", () => {
  it("returns true when transitioning from hidden to visible", () => {
    assert.equal(shouldResetOnVisibleChange(false, true), true);
  });

  it("returns false when already visible", () => {
    assert.equal(shouldResetOnVisibleChange(true, true), false);
  });

  it("returns false when transitioning from visible to hidden", () => {
    assert.equal(shouldResetOnVisibleChange(true, false), false);
  });

  it("returns false when staying hidden", () => {
    assert.equal(shouldResetOnVisibleChange(false, false), false);
  });
});

describe("reducerOnImportSeedPhraseInstead", () => {
  it("pivots from 'pk' to 'seed'", () => {
    assert.equal(reducerOnImportSeedPhraseInstead("pk"), "seed");
  });

  it("is a no-op when called from 'picker'", () => {
    // Defensive: the link is only rendered inside the PK sub-sheet, so
    // any other caller would be a wiring bug — we don't want the sheet
    // jumping to seed from an unexpected state.
    assert.equal(reducerOnImportSeedPhraseInstead("picker"), "picker");
  });

  it("is a no-op when called from 'create'", () => {
    assert.equal(reducerOnImportSeedPhraseInstead("create"), "create");
  });

  it("is a no-op when called from 'seed' (already there)", () => {
    assert.equal(reducerOnImportSeedPhraseInstead("seed"), "seed");
  });
});
