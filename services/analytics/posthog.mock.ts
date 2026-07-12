// Test-only stand-in for services/analytics/posthog.ts. Vitest aliases the
// exact specifier "@/services/analytics/posthog" to this file (see
// vitest.config.ts) so pure-logic suites (e.g. agent-executor tests) never
// load the real posthog-react-native SDK — that package (and its
// expo-application/expo-device peers) ships React Native/Flow syntax that
// isn't parseable outside a Metro/RN transform, so a bare import crashes
// Vitest at module-load time regardless of which test case runs.
export const posthog = {
  identify: () => {},
  capture: () => {},
  screen: async () => {},
  optIn: async () => {},
  optOut: async () => {},
};

export function track(): void {}
