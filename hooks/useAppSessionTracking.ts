import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { track } from "@/services/analytics/posthog";

/**
 * Fires `app_session_started` once per real usage session — cold start, or
 * resuming from the background — gated on the wallet actually being
 * unlocked. This is the baseline DAU/WAU/MAU signal (not an auth event: no
 * form, nothing user-facing). It re-arms every time the app returns from the
 * background so a user who backgrounds and reopens the app later that day
 * counts as a new session, not just once at cold start.
 */
export function useAppSessionTracking(locked: boolean): void {
  const canFireRef = useRef(true);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        canFireRef.current = true;
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!locked && canFireRef.current) {
      canFireRef.current = false;
      track("app_session_started");
    }
  }, [locked]);
}
