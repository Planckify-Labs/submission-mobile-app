import { PostHog } from "posthog-react-native";
import type { AnalyticsEvent, AnalyticsEventProps } from "./events";
import { posthogMmkvStorage } from "./mmkvStorage";

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? "";
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

// `disabled: !apiKey` means local/dev builds that leave the key blank never
// send anything — no __DEV__ branching needed, and production MAU/DAU stays
// clean of dev-testing noise. Only EAS build profiles/secrets set the real key.
// Screen/lifecycle autocapture is off: screens are tracked manually (expo-router
// has no NavigationContainer to hook into) and app-session tracking is
// hand-rolled in hooks/useAppSessionTracking.ts for a single, precisely-defined
// "active session" signal.
export const posthog = new PostHog(apiKey || "phc_local_dev_placeholder", {
  host,
  customStorage: posthogMmkvStorage,
  disabled: !apiKey,
  captureAppLifecycleEvents: false,
  enableSessionReplay: false,
});

type TrackArgs<E extends AnalyticsEvent> =
  AnalyticsEventProps[E] extends Record<string, never>
    ? []
    : [AnalyticsEventProps[E]];

// Thin wrapper so a capture failure never throws into a payment/swap/agent
// flow — analytics must be invisible to the user on failure.
export function track<E extends AnalyticsEvent>(
  event: E,
  ...args: TrackArgs<E>
): void {
  if (!apiKey) return;
  try {
    posthog.capture(event, args[0]);
  } catch (e) {
    if (__DEV__) console.warn("[analytics] capture failed", e);
  }
}
