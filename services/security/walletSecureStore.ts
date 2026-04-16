// TWV-2026-004 — Centralised `SecureStore` wrapper for wallet-credential
// material (seed phrase, private key, signing key, session/refresh tokens,
// PIN hash). Every read/write/delete for these items MUST go through this
// module so the `WHEN_UNLOCKED_THIS_DEVICE_ONLY` accessibility flag is
// never omitted. Direct `SecureStore.setItemAsync(key, value)` on
// wallet-credential keys is a regression.
//
// The flag:
// - prevents iCloud-Keychain sync of the seed (closes the MetaMask 2022
//   ≥$655k loss vector: Apple-ID phish → seed compromise on a second
//   device), and
// - makes the item unreadable after device is wiped / passcode is
//   removed, which aligns with the §9 "Key custody" row.
//
// Task TWV-2026-060 (Phase 1 task 11) will tighten the wrapper further by
// passing `requireAuthentication: true` on reads that unwrap signing
// material; keep those two flags orthogonal.

import * as SecureStore from "expo-secure-store";
import { storage } from "@/lib/storage/mmkv";

export const WALLET_SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// TWV-2026-060 — signing-material reads add OS-level biometric gating
// on top of the device-only accessibility. The prompt string is
// displayed by the platform auth sheet, not by the app's own UI, so
// copy is short and explicit.
export const SIGNING_SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: true,
  authenticationPrompt: "Authenticate to unlock wallet",
};

const MIGRATION_FLAG_PREFIX = "ss_migrated_v1:";

export async function walletSecureSet(
  key: string,
  value: string,
  extra?: SecureStore.SecureStoreOptions,
): Promise<void> {
  await SecureStore.setItemAsync(key, value, {
    ...WALLET_SECURE_STORE_OPTIONS,
    ...extra,
  });
}

export async function walletSecureGet(
  key: string,
  extra?: SecureStore.SecureStoreOptions,
): Promise<string | null> {
  const value = await SecureStore.getItemAsync(key, {
    ...WALLET_SECURE_STORE_OPTIONS,
    ...extra,
  });
  if (value != null) {
    // Lazy self-healing migration — rewrite once per key so any legacy
    // entry written without the device-only flag is upgraded in place.
    const migKey = `${MIGRATION_FLAG_PREFIX}${key}`;
    if (!storage.getBoolean(migKey)) {
      try {
        await SecureStore.setItemAsync(key, value, {
          ...WALLET_SECURE_STORE_OPTIONS,
          ...extra,
        });
        storage.set(migKey, true);
      } catch (e) {
        if (__DEV__)
          console.warn(`[walletSecureStore] lazy migration failed ${key}`, e);
      }
    }
  }
  return value;
}

export async function walletSecureDelete(
  key: string,
  extra?: SecureStore.SecureStoreOptions,
): Promise<void> {
  await SecureStore.deleteItemAsync(key, {
    ...WALLET_SECURE_STORE_OPTIONS,
    ...extra,
  });
}

/**
 * Signing-material write. Adds `requireAuthentication: true` on top of
 * the device-only accessibility flag, so every subsequent read triggers
 * the OS biometric prompt. Callers MUST route every seed / private-key
 * / signing-key write through this path.
 */
export async function signingSecureSet(
  key: string,
  value: string,
  extra?: SecureStore.SecureStoreOptions,
): Promise<void> {
  await SecureStore.setItemAsync(key, value, {
    ...SIGNING_SECURE_STORE_OPTIONS,
    ...extra,
  });
}

/**
 * Signing-material read. Triggers biometric auth at the OS level (Face
 * ID / Touch ID / Android BiometricPrompt).
 *
 * NOTE: No lazy-rewrite after a successful read. Chaining an
 * auth-gated `setItemAsync` immediately after an auth-gated
 * `getItemAsync` collides on Android — the first prompt is still in
 * teardown when the second starts, so the OS rejects with
 * "Authentication is already in progress". Legacy entries are
 * upgraded on the next affirmative save (`saveWalletsToStorage` etc.),
 * not here.
 */
export async function signingSecureGet(
  key: string,
  extra?: SecureStore.SecureStoreOptions,
): Promise<string | null> {
  return SecureStore.getItemAsync(key, {
    ...SIGNING_SECURE_STORE_OPTIONS,
    ...extra,
  });
}

export async function signingSecureDelete(
  key: string,
  extra?: SecureStore.SecureStoreOptions,
): Promise<void> {
  await SecureStore.deleteItemAsync(key, {
    ...SIGNING_SECURE_STORE_OPTIONS,
    ...extra,
  });
}

/**
 * Re-write an existing item with the device-only flag. Used by the boot
 * migration below to upgrade legacy entries without prompting the user.
 * Idempotent: if the key does not exist, nothing happens.
 */
async function rewriteWithFlagIfPresent(key: string): Promise<void> {
  const current = await SecureStore.getItemAsync(key);
  if (current == null) return;
  await SecureStore.setItemAsync(key, current, WALLET_SECURE_STORE_OPTIONS);
}

/**
 * Forward migration (§7.1.3 — never reset). On first boot under this
 * build, rewrite every known wallet-credential key with the device-only
 * flag. Callers pass the list of concrete keys discovered at runtime
 * (e.g. the wallet index expands into N `wallet_<addr>` keys).
 */
export async function migrateWalletSecureStoreKeys(
  keys: readonly string[],
): Promise<void> {
  for (const k of keys) {
    try {
      await rewriteWithFlagIfPresent(k);
    } catch (e) {
      if (__DEV__)
        console.warn(`[walletSecureStore] migration failed for ${k}`, e);
    }
  }
}
