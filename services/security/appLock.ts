/**
 * App lock state machine: biometric + PIN authentication.
 */

import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import * as SQLite from "expo-sqlite";

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
      "CREATE TABLE IF NOT EXISTS lock_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);"
    );
  }
  return db;
}

export function getConfig(): AppLockConfig {
  const database = getDb();
  const row = database.getFirstSync<{ value: string }>(
    "SELECT value FROM lock_config WHERE key = ?", ["config"],
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

// PIN is stored as a hash in SecureStore
export async function isPinSet(): Promise<boolean> {
  const hash = await SecureStore.getItemAsync("pin_hash");
  return !!hash;
}

export async function setPin(pin: string): Promise<void> {
  const salt = generateSalt();
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync("pin_hash", hash);
  await SecureStore.setItemAsync("pin_salt", salt);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = await SecureStore.getItemAsync("pin_hash");
  const salt = await SecureStore.getItemAsync("pin_salt");
  if (!storedHash || !salt) return false;
  const hash = await hashPin(pin, salt);
  return hash === storedHash;
}

async function hashPin(pin: string, salt: string): Promise<string> {
  // SHA-256 with salt — in production use react-native-argon2
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getLockState(): LockState { return currentState; }

export function setLockState(state: LockState): void {
  currentState = state;
  if (state === "unlocked") lastUnlockedAt = Date.now();
}

export function isLockEnabled(): boolean { return currentState !== "unset"; }

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
  if (action === "send" && amountUsd != null && amountUsd < config.smallAmountThreshold) return false;
  return true;
}
