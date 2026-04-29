/**
 * Option-shape tests for `walletSecureStore` — TWV-2026-004 and
 * TWV-2026-060. Asserts the constants passed to every SecureStore call
 * carry the required flags. The helper itself is trivial over these
 * constants; a full end-to-end test would need a native SecureStore +
 * MMKV runtime.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/walletSecureStore.test.ts
 */

import assert from "node:assert/strict";
import Module from "node:module";
import { describe, it } from "node:test";

// `expo-secure-store` exports the accessibility constants as real
// strings at runtime. Under node:test the native binding is missing,
// so we shim just the constants we read.
// deno-lint-ignore no-explicit-any
const orig = (Module as any)._resolveFilename;
// deno-lint-ignore no-explicit-any
(Module as any)._resolveFilename = function (request: string, ...rest: any[]) {
  if (request === "expo-secure-store") return "expo-secure-store-fake";
  return orig.call(this, request, ...rest);
};
// deno-lint-ignore no-explicit-any
(Module as any)._cache["expo-secure-store-fake"] = {
  id: "expo-secure-store-fake",
  filename: "expo-secure-store-fake",
  loaded: true,
  exports: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "__device_only__",
    setItemAsync: async () => {},
    getItemAsync: async () => null,
    deleteItemAsync: async () => {},
  },
};

// Read the source of truth without pulling the full helper (which
// imports `@/lib/storage/mmkv`, an ESM path alias unresolvable under
// plain node). Option constants are the contract TWV-2026-004/060 pin.
const src = (await import("node:fs")).readFileSync(
  new URL("./walletSecureStore.ts", import.meta.url),
  "utf-8",
);

describe("WALLET_SECURE_STORE_OPTIONS — TWV-2026-004", () => {
  it("declares the device-only accessibility flag", () => {
    assert.match(
      src,
      /WALLET_SECURE_STORE_OPTIONS[\s\S]*?keychainAccessible:\s*SecureStore\.WHEN_UNLOCKED_THIS_DEVICE_ONLY/,
    );
  });

  it("does NOT pre-declare requireAuthentication on the base options", () => {
    // Signing-only tightening lives in a separate constant so
    // non-signing reads (session tokens, PIN hash) don't biometric-prompt.
    const baseBlock = src.match(
      /WALLET_SECURE_STORE_OPTIONS:\s*SecureStore\.SecureStoreOptions\s*=\s*\{([\s\S]*?)\};/,
    );
    assert.ok(baseBlock);
    assert.doesNotMatch(baseBlock[1] ?? "", /requireAuthentication/);
  });
});

describe("SIGNING_SECURE_STORE_OPTIONS — TWV-2026-060 (revised)", () => {
  // Revised: `requireAuthentication: true` was dropped because
  // expo-secure-store v15 forces biometric-only on Android (no device-
  // credential fallback), which locks users out when biometry is
  // unavailable or unenrolled. The user gate now lives in the app-level
  // `LockScreen` via `expo-local-authentication`. At-rest protection
  // stays `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
  it("keeps the device-only accessibility flag on signing options", () => {
    const sigBlock = src.match(
      /SIGNING_SECURE_STORE_OPTIONS:\s*SecureStore\.SecureStoreOptions\s*=\s*\{([\s\S]*?)\};/,
    );
    assert.ok(sigBlock);
    assert.match(
      sigBlock[1] ?? "",
      /keychainAccessible:\s*SecureStore\.WHEN_UNLOCKED_THIS_DEVICE_ONLY/,
    );
  });

  it("does NOT set requireAuthentication on signing options (Android lockout fix)", () => {
    const sigBlock = src.match(
      /SIGNING_SECURE_STORE_OPTIONS:\s*SecureStore\.SecureStoreOptions\s*=\s*\{([\s\S]*?)\};/,
    );
    assert.ok(sigBlock);
    assert.doesNotMatch(sigBlock[1] ?? "", /requireAuthentication/);
  });
});

describe("walletSecureStore — signing helpers exist", () => {
  it("exports signingSecureSet / Get / Delete", () => {
    assert.match(src, /export async function signingSecureSet/);
    assert.match(src, /export async function signingSecureGet/);
    assert.match(src, /export async function signingSecureDelete/);
  });

  it("signing helpers spread SIGNING_SECURE_STORE_OPTIONS", () => {
    assert.match(
      src,
      /signingSecureSet[\s\S]*?\.\.\.SIGNING_SECURE_STORE_OPTIONS/,
    );
    assert.match(
      src,
      /signingSecureGet[\s\S]*?\.\.\.SIGNING_SECURE_STORE_OPTIONS/,
    );
    assert.match(
      src,
      /signingSecureDelete[\s\S]*?\.\.\.SIGNING_SECURE_STORE_OPTIONS/,
    );
  });
});
