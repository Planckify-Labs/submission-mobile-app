/**
 * Unit tests for `PreviewCard` countdown primitives.
 *
 * The mobile-app repo does not ship a React Native component test
 * runner (no Jest, no @testing-library/react-native). Adding one just
 * for this task is out of scope per the task spec, so this file tests
 * the pure `computeProgress` helper — the only piece of the component
 * that can be exercised without mounting a React tree.
 *
 * The higher-level countdown hook `usePreviewCountdown` depends on
 * `react-native` (`AppState`, `AccessibilityInfo`) which cannot be
 * imported under plain `node:test`. The three UI states (countdown,
 * cancelled, confirmed) are documented below as TODO snapshots for
 * whenever the repo gains a component test runner.
 *
 * Run from the mobile-app root with:
 *
 *     node --test --experimental-strip-types \
 *       components/home/TakumiAgent/PreviewCard/PreviewCard.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeProgress } from "./computeProgress.ts";

describe("computeProgress", () => {
  it("returns 0 at the start of the countdown", () => {
    assert.equal(computeProgress(3000, 3000), 0);
  });

  it("returns 1 at the end of the countdown", () => {
    assert.equal(computeProgress(3000, 0), 1);
  });

  it("returns 0.5 halfway through", () => {
    assert.equal(computeProgress(3000, 1500), 0.5);
  });

  it("clamps below 0 when remaining exceeds the total", () => {
    // Shouldn't happen in practice, but the helper guards against it.
    assert.equal(computeProgress(3000, 9000), 0);
  });

  it("clamps above 1 when remaining goes negative", () => {
    assert.equal(computeProgress(3000, -500), 1);
  });

  it("returns 1 when the total is zero (avoids divide-by-zero)", () => {
    assert.equal(computeProgress(0, 0), 1);
    assert.equal(computeProgress(0, 100), 1);
  });

  it("monotonically increases as remainingMs shrinks", () => {
    const total = 3000;
    let last = -1;
    for (let r = total; r >= 0; r -= 250) {
      const p = computeProgress(total, r);
      assert.ok(p >= last, `progress should not decrease: ${p} < ${last}`);
      last = p;
    }
    assert.equal(last, 1);
  });
});

/**
 * TODO(repo): add React Native Testing Library (or Jest + RNTL) and
 * port the following three state snapshots from prose into live tests:
 *
 *   1. "countdown" — renders summary, ring at 0%, two action buttons.
 *   2. "cancelled" — tapping Cancel collapses to the compact cancelled
 *      card, fires `onDismiss` exactly once, subsequent taps no-op.
 *   3. "confirmed" — the timer elapses OR Approve is tapped, collapses
 *      to the compact approved card, fires `onConfirm` exactly once.
 *
 * All three are covered by manual QA until then.
 */
