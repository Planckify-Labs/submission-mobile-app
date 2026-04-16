// TWV-2026-035 — "Signing mode" profile. When enabled the wallet
// shrinks its attack surface: no dApp browser, no deeplinks routed to
// action screens, no push notifications. Lifecycle modelled after the
// Radiant Capital ($50M, Oct 2024) post-mortem — keep the signer
// device free of the channels that delivered the compromise.
//
// Storage: a single boolean in SecureStore (auth-gated) so flipping
// the mode OFF requires biometrics. Reads are synchronous via the
// in-process cache below; the hook subscribes to changes.

import {
  signingSecureGet,
  signingSecureSet,
} from "@/services/security/walletSecureStore";

const STORAGE_KEY = "signing_mode_enabled_v1";

let cached: boolean | null = null;
const listeners = new Set<(enabled: boolean) => void>();

export function getSigningModeSync(): boolean {
  return cached ?? false;
}

/**
 * Boot-time hydration. Call once from `app/_layout.tsx`.
 */
export async function hydrateSigningMode(): Promise<boolean> {
  try {
    const raw = await signingSecureGet(STORAGE_KEY);
    cached = raw === "1";
  } catch {
    cached = false;
  }
  notify();
  return cached ?? false;
}

/**
 * Set the toggle. The caller MUST first verify biometric / app
 * password — this function does NOT enforce that itself, only
 * persists the value.
 */
export async function setSigningMode(enabled: boolean): Promise<void> {
  cached = enabled;
  await signingSecureSet(STORAGE_KEY, enabled ? "1" : "0");
  notify();
}

export function subscribeSigningMode(
  fn: (enabled: boolean) => void,
): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const l of listeners) {
    try {
      l(cached ?? false);
    } catch {
      // best-effort
    }
  }
}

/**
 * Helper for deeplink router / dApp-browser entry points / push
 * dispatcher. Returns true if the surface should be short-circuited.
 */
export function isSurfaceDisabled(
  surface: "dapp_browser" | "deeplink" | "push" | "agent_link",
): boolean {
  if (!getSigningModeSync()) return false;
  // All four surfaces are disabled in Signing mode — ordering kept so
  // a future mode could granularly enable one of them.
  return surface !== ("__never__" as typeof surface);
}
