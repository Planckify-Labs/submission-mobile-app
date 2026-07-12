import * as Application from "expo-application";
import { Platform } from "react-native";
import type { TWallet } from "@/constants/types/walletTypes";
import { posthog } from "./posthog";

let cachedDeviceId: string | null = null;

// Stable per-device id, not per-wallet — one device can hold many wallets
// (multi-wallet is core to this app), so identifying by wallet would
// fragment one human into N PostHog "people." IDFV/ANDROID_ID (not
// IDFA/GAID) survive reinstall without requiring an App Tracking
// Transparency prompt, since we run no ad campaigns.
async function resolveStableDeviceId(): Promise<string> {
  if (Platform.OS === "ios") {
    const idfv = await Application.getIosIdForVendorAsync();
    if (idfv) return idfv;
    // Can return null briefly right after a device restart, before unlock.
    return "unknown-ios-device";
  }
  if (Platform.OS === "android") {
    return Application.getAndroidId();
  }
  return "unknown-device";
}

export async function identifyDevice(): Promise<void> {
  if (!cachedDeviceId) {
    cachedDeviceId = await resolveStableDeviceId();
  }
  posthog.identify(cachedDeviceId);
}

// Wallet data lives on the device-person as properties, never as a second
// identity — this is what lets "one device, three wallets" stay one
// PostHog person instead of becoming three.
export function syncWalletProperties(wallets: TWallet[]): void {
  if (!cachedDeviceId) return;
  const chainsUsed = [...new Set(wallets.map((w) => w.namespace))];
  posthog.identify(cachedDeviceId, {
    wallet_count: wallets.length,
    chains_used: chainsUsed,
    has_multiple_wallets: wallets.length > 1,
  });
}
