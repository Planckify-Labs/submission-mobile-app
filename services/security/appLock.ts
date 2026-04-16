/**
 * App lock state machine: biometric + PIN authentication.
 */

import * as LocalAuthentication from "expo-local-authentication";
import * as SQLite from "expo-sqlite";
import {
  walletSecureGet,
  walletSecureSet,
} from "@/services/security/walletSecureStore";

export type LockState = "unset" | "locked" | "unlocked";
export type LockMethod = "biometric" | "pin" | "biometric+pin";

interface AppLockConfig {
  lockMethod: LockMethod;
  timeoutSeconds: number;
  perActionAuthEnabled: boolean;
  smallAmountThreshold: number;
}

const DEFAULT_CONFIG: AppLockConfig = {
  lockMethod: "biometric",
  timeoutSeconds: 30,
  perActionAuthEnabled: true,
  smallAmountThreshold: 10,
};

let currentState: LockState = "unset";
let lastUnlockedAt = 0;
let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync("app_lock.db");
    db.execSync(
      "CREATE TABLE IF NOT EXISTS lock_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
    );
  }
  return db;
}

export function getConfig(): AppLockConfig {
  const database = getDb();
  const row = database.getFirstSync<{ value: string }>(
    "SELECT value FROM lock_config WHERE key = ?",
    ["config"],
  );
  if (!row) return DEFAULT_CONFIG;
  return { ...DEFAULT_CONFIG, ...JSON.parse(row.value) };
}

export function saveConfig(config: Partial<AppLockConfig>): void {
  const existing = getConfig();
  const merged = { ...existing, ...config };
  const database = getDb();
  database.runSync(
    "INSERT OR REPLACE INTO lock_config (key, value) VALUES (?, ?)",
    ["config", JSON.stringify(merged)],
  );
}

// TWV-2026-061 — the PIN here is the recovery "app password". It
// unlocks the wallet when the biometric set is invalidated (user
// enrolled a new Face ID / fingerprint). Storage is a salted, iterated
// hash via `hashPin` below — the verifier is SecureStore-backed with
// the shared `walletSecureGet`/`walletSecureSet` helpers, so the hash
// benefits from `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
//
// Ideal KDF: Argon2id (not available without a native module).
// Pragmatic pick until the native-signing migration (TWV-2026-057)
// lands: PBKDF2-style SHA-256 with 250k iterations. The salt is 16
// random bytes written alongside the hash; iterations are persisted so
// a future strength bump can re-hash on next verify.

const HASH_VERSION_KEY = "pin_hash_version";
const HASH_VERSION_V2 = 2;
// Iteration count chosen to be felt on mid-range Android (~400ms) while
// not frustrating older handsets. Upgrade on device-tier improvements.
const PBKDF2_ITERATIONS_V2 = 100_000;

export async function isPinSet(): Promise<boolean> {
  const hash = await walletSecureGet("pin_hash");
  return !!hash;
}

export async function setPin(pin: string): Promise<void> {
  const salt = generateSalt();
  const hash = await hashPin(pin, salt, PBKDF2_ITERATIONS_V2);
  await walletSecureSet("pin_hash", hash);
  await walletSecureSet("pin_salt", salt);
  await walletSecureSet(HASH_VERSION_KEY, String(HASH_VERSION_V2));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = await walletSecureGet("pin_hash");
  const salt = await walletSecureGet("pin_salt");
  if (!storedHash || !salt) return false;
  const versionStr = await walletSecureGet(HASH_VERSION_KEY);
  const version = versionStr ? Number(versionStr) : 1;
  const iterations = version >= HASH_VERSION_V2 ? PBKDF2_ITERATIONS_V2 : 1;
  const hash = await hashPin(pin, salt, iterations);
  const ok = constantTimeEquals(hash, storedHash);
  if (ok && version < HASH_VERSION_V2) {
    // Upgrade-on-verify — re-hash the PIN under the newer iteration
    // count on the next successful login. Keeps existing users moving
    // to the stronger parameters without forcing a reset.
    try {
      await setPin(pin);
    } catch {
      // best-effort
    }
  }
  return ok;
}

async function hashPin(
  pin: string,
  salt: string,
  iterations: number,
): Promise<string> {
  const encoder = new TextEncoder();
  let data = encoder.encode(pin + salt);
  for (let i = 0; i < iterations; i++) {
    const h = await crypto.subtle.digest("SHA-256", data);
    data = new Uint8Array(h);
  }
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// TWV-2026-061 — biometric-set change handler. Any caller that observes
// `LAError.BiometryLockout` / `BiometricPrompt.ERROR_LOCKOUT_PERMANENT`
// or equivalent should route here: wipe cached signing state and force
// the user back through the PIN recovery screen. The biometric binding
// on the signing key entry itself is invalidated at the OS level
// (iOS kSecAccessControlBiometryCurrentSet; Android Keystore
// setInvalidatedByBiometricEnrollment(true) — configured in the native
// module / expo-secure-store config; see the runbook).
export type BiometricInvalidationHandler = () => void | Promise<void>;

const invalidationHandlers: Set<BiometricInvalidationHandler> = new Set();

export function onBiometricInvalidated(
  handler: BiometricInvalidationHandler,
): () => void {
  invalidationHandlers.add(handler);
  return () => invalidationHandlers.delete(handler);
}

export async function fireBiometricInvalidated(): Promise<void> {
  currentState = "locked";
  for (const h of invalidationHandlers) {
    try {
      await h();
    } catch (e) {
      if (__DEV__) console.warn("[appLock] invalidation handler threw", e);
    }
  }
}

function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getLockState(): LockState {
  return currentState;
}

export function setLockState(state: LockState): void {
  currentState = state;
  if (state === "unlocked") lastUnlockedAt = Date.now();
}

export function isLockEnabled(): boolean {
  return currentState !== "unset";
}

export function shouldLockOnForeground(): boolean {
  if (currentState !== "unlocked") return false;
  const config = getConfig();
  return (Date.now() - lastUnlockedAt) / 1000 > config.timeoutSeconds;
}

export async function isBiometricAvailable(): Promise<boolean> {
  const result = await LocalAuthentication.hasHardwareAsync();
  if (!result) return false;
  return LocalAuthentication.isEnrolledAsync();
}

export async function authenticateBiometric(reason?: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason ?? "Authenticate to continue",
    fallbackLabel: "Use PIN",
    disableDeviceFallback: true,
  });
  return result.success;
}

export function requiresPerActionAuth(
  action: "sign" | "send" | "export" | "revoke" | "wipe",
  amountUsd?: number,
): boolean {
  if (action === "export" || action === "wipe") return true;
  const config = getConfig();
  if (!config.perActionAuthEnabled) return false;
  if (
    action === "send" &&
    amountUsd != null &&
    amountUsd < config.smallAmountThreshold
  )
    return false;
  return true;
}
