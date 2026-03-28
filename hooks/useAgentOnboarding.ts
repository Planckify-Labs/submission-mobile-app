import { useCallback, useState } from "react";
import { storage } from "@/lib/storage/mmkv";

const AGENT_ONBOARDING_KEY = "takumipay_agent_onboarding_completed";

export interface UseAgentOnboardingReturn {
  shouldShowOnboarding: boolean;
  isLoading: boolean;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export function useAgentOnboarding(): UseAgentOnboardingReturn {
  // Synchronous MMKV read — no async lifecycle, no isLoading state
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(
    () => storage.getString(AGENT_ONBOARDING_KEY) !== "true",
  );

  const completeOnboarding = useCallback(() => {
    storage.set(AGENT_ONBOARDING_KEY, "true");
    setShouldShowOnboarding(false);
  }, []);

  const resetOnboarding = useCallback(() => {
    storage.remove(AGENT_ONBOARDING_KEY);
    setShouldShowOnboarding(true);
  }, []);

  return {
    shouldShowOnboarding,
    isLoading: false, // synchronous — never in a loading state
    completeOnboarding,
    resetOnboarding,
  };
}
