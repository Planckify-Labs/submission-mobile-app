/**
 * Pure countdown progress helper for `PreviewCard`.
 *
 * Lives in its own module with zero runtime imports so it can be
 * exercised under `node:test` without loading `react-native`. The
 * `usePreviewCountdown` hook re-exports this function so consumers
 * have one import path.
 */

/**
 * Given the total countdown window and the remaining milliseconds,
 * return the elapsed fraction clamped to `[0, 1]`.
 *
 * Guarantees:
 *   - `computeProgress(n, n)` is 0 (nothing elapsed yet)
 *   - `computeProgress(n, 0)` is 1 (fully elapsed)
 *   - `computeProgress(0, _)` is 1 (divide-by-zero guard)
 *   - Values are clamped to the unit interval even if callers pass
 *     nonsensical inputs (negative remaining, remaining > total).
 */
export function computeProgress(
  autoConfirmMs: number,
  remainingMs: number,
): number {
  if (autoConfirmMs <= 0) return 1;
  const elapsed = autoConfirmMs - remainingMs;
  if (elapsed <= 0) return 0;
  if (elapsed >= autoConfirmMs) return 1;
  return elapsed / autoConfirmMs;
}
