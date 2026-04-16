/**
 * Screenshot / screen-recording prevention for sensitive screens —
 * TWV-2026-023 (SpyAgent-class Android malware and iOS ReplayKit).
 *
 * Guard is *refcounted* so two nested guarded screens unmounting in
 * reverse order leave capture disabled until the outer unmount. Android
 * uses `FLAG_SECURE` under the hood (opaque recent-apps tile). iOS 13+
 * blocks screenshots and recordings; `addScreenshotListener` surfaces a
 * best-effort "never screenshot this" nudge when the user tries one.
 *
 * Every seed / private-key / signature-prompt screen MUST call
 * `useScreenshotGuard()`. See the sign-sheet renderers and the
 * SeedExportScreen for current call sites.
 */

import * as ScreenCapture from "expo-screen-capture";
import { useEffect } from "react";
import { Alert, Platform } from "react-native";

// Module-level refcount. Multiple guarded screens can mount concurrently
// (e.g. seed display → confirm-phrase step → signer sheet on top).
let activeCount = 0;
let screenshotSub: ScreenCapture.Subscription | null = null;

const GUARD_KEY = "takumipay-sensitive-screen";

async function engage(): Promise<void> {
  if (activeCount === 1) {
    try {
      await ScreenCapture.preventScreenCaptureAsync(GUARD_KEY);
      if (Platform.OS === "ios") {
        try {
          await ScreenCapture.enableAppSwitcherProtectionAsync(0.8);
        } catch {
          // Older iOS — best-effort only.
        }
        screenshotSub = ScreenCapture.addScreenshotListener(() => {
          Alert.alert(
            "Never screenshot this",
            "Screenshots of your seed phrase or signature prompt defeat " +
              "device encryption. Please delete the screenshot now.",
            [{ text: "OK" }],
          );
        });
      }
    } catch (e) {
      if (__DEV__) console.warn("[screenshotGuard] engage failed", e);
    }
  }
}

async function release(): Promise<void> {
  if (activeCount === 0) {
    try {
      await ScreenCapture.allowScreenCaptureAsync(GUARD_KEY);
      if (Platform.OS === "ios") {
        try {
          await ScreenCapture.disableAppSwitcherProtectionAsync();
        } catch {
          // ignore
        }
        if (screenshotSub) {
          screenshotSub.remove();
          screenshotSub = null;
        }
      }
    } catch (e) {
      if (__DEV__) console.warn("[screenshotGuard] release failed", e);
    }
  }
}

/** @internal — exposed for unit tests only. */
export function __resetGuardForTests(): void {
  activeCount = 0;
  screenshotSub = null;
}

/** @internal — exposed for unit tests only. */
export function __getActiveCountForTests(): number {
  return activeCount;
}

/**
 * Prevent screenshots / recordings while the owning component is
 * mounted. Refcounted — outer guards stay active until inner guards
 * release. `active=false` disables the guard (useful for conditional
 * screens that only need protection during specific sub-steps).
 */
export function useScreenshotGuard(active = true): void {
  useEffect(() => {
    if (!active) return;
    activeCount += 1;
    void engage();
    return () => {
      activeCount = Math.max(0, activeCount - 1);
      void release();
    };
  }, [active]);
}
