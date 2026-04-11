/**
 * Headless countdown hook for `PreviewCard`.
 *
 * Extracted from the component so the timing/resolution logic can be
 * unit-tested with `node:test` without pulling in React Native.
 *
 * Responsibilities:
 *   - Tick a remaining-ms timer at a fixed interval.
 *   - Pause when the app is backgrounded (`AppState`) or when the parent
 *     reports an SSE reconnect in progress.
 *   - Fire `onElapsed()` exactly once when the countdown hits zero while
 *     the timer is running.
 *   - Expose a `confirmNow()` / `cancel()` pair that resolves the card
 *     without waiting for the countdown.
 *
 * The pure `computeProgress` helper is exported so tests can validate
 * the progress math without mounting anything.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, type AppStateStatus } from "react-native";

import { computeProgress } from "./computeProgress";

// Re-exported for ergonomic single-import usage; the implementation
// lives in its own RN-free module so it can be unit-tested under
// `node:test` without loading `react-native`.
export { computeProgress };

export type PreviewCardStatus =
  | "counting"
  | "paused"
  | "confirmed"
  | "cancelled";

export interface UsePreviewCountdownArgs {
  autoConfirmMs: number;
  onConfirm: () => void;
  onDismiss: () => void;
  /**
   * When true, the countdown is paused and displays a "Reconnecting…"
   * state. Task 09 will wire this from the SSE dispatcher's connection
   * state. Defaults to `false`.
   */
  isReconnecting?: boolean;
}

export interface UsePreviewCountdownResult {
  status: PreviewCardStatus;
  /** Remaining milliseconds on the countdown, clamped to [0, autoConfirmMs]. */
  remainingMs: number;
  /** Fraction elapsed in [0, 1]. Useful for a circular progress indicator. */
  progress: number;
  reduceMotion: boolean;
  confirmNow: () => void;
  cancel: () => void;
}

const TICK_MS = 50;

export function usePreviewCountdown(
  args: UsePreviewCountdownArgs,
): UsePreviewCountdownResult {
  const { autoConfirmMs, onConfirm, onDismiss, isReconnecting = false } = args;

  const [status, setStatus] = useState<PreviewCardStatus>("counting");
  const [remainingMs, setRemainingMs] = useState<number>(autoConfirmMs);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  const [appActive, setAppActive] = useState<boolean>(
    AppState.currentState === "active",
  );

  // Refs so the tick closure can observe latest status/remaining without
  // re-creating the interval every frame.
  const statusRef = useRef(status);
  const remainingRef = useRef(remainingMs);
  const resolvedRef = useRef(false);
  const onConfirmRef = useRef(onConfirm);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    remainingRef.current = remainingMs;
  }, [remainingMs]);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  // Reduced-motion preference. We only query once — a session-scoped
  // preview is not long-lived enough to warrant a change listener.
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReduceMotion(enabled);
      })
      .catch(() => {
        // Silently default to false on platforms that don't implement it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // AppState subscription: pause the timer while backgrounded.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      setAppActive(next === "active");
    });
    return () => sub.remove();
  }, []);

  // The actual tick loop. We decrement `remainingMs` on an interval and
  // fire `onConfirm` exactly once when it reaches zero.
  useEffect(() => {
    if (resolvedRef.current) return;
    if (statusRef.current !== "counting") return;
    if (!appActive || isReconnecting) return;

    const interval = setInterval(() => {
      if (resolvedRef.current) {
        clearInterval(interval);
        return;
      }
      const next = Math.max(0, remainingRef.current - TICK_MS);
      remainingRef.current = next;
      setRemainingMs(next);

      if (next <= 0) {
        clearInterval(interval);
        if (!resolvedRef.current) {
          resolvedRef.current = true;
          setStatus("confirmed");
          try {
            onConfirmRef.current();
          } catch (err) {
            console.error("PreviewCard: onConfirm threw", err);
          }
        }
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [appActive, isReconnecting]);

  // Update the surfaced status when the pause conditions flip. We don't
  // change the underlying remaining-ms so the timer resumes where it
  // left off.
  useEffect(() => {
    if (resolvedRef.current) return;
    const shouldPause = !appActive || isReconnecting;
    setStatus(shouldPause ? "paused" : "counting");
  }, [appActive, isReconnecting]);

  const confirmNow = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setStatus("confirmed");
    setRemainingMs(0);
    try {
      onConfirmRef.current();
    } catch (err) {
      console.error("PreviewCard: onConfirm threw", err);
    }
  }, []);

  const cancel = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setStatus("cancelled");
    try {
      onDismissRef.current();
    } catch (err) {
      console.error("PreviewCard: onDismiss threw", err);
    }
  }, []);

  return {
    status,
    remainingMs,
    progress: computeProgress(autoConfirmMs, remainingMs),
    reduceMotion,
    confirmNow,
    cancel,
  };
}
