import QRC from "qrcode";
import { createMMKV } from "react-native-mmkv";

// Dedicated MMKV instance — independent of the main app storage so a
// QR cache clear doesn't thrash wallet reads, and vice-versa.
const qrStore = createMMKV({ id: "takumipay-qr-cache" });

// Bump on encoding changes. Entries keyed by an older version are
// invisible to readers and get reclaimed on next write churn.
const CACHE_VERSION = 1;
const KEY_PREFIX = `qr:v${CACHE_VERSION}:`;

type CachedMatrix = { size: number; data: string };
type InternalEntry = { size: number; data: Uint8Array };

const memCache = new Map<string, InternalEntry>();

function optionsKey(options: unknown): string {
  if (!options) return "";
  const o = options as {
    version?: unknown;
    errorCorrectionLevel?: unknown;
    maskPattern?: unknown;
  };
  return `${o.version ?? ""}:${o.errorCorrectionLevel ?? ""}:${o.maskPattern ?? ""}`;
}

function cacheKey(message: unknown, options: unknown): string | null {
  if (typeof message !== "string" || message.length === 0) return null;
  return `${KEY_PREFIX}${optionsKey(options)}|${message}`;
}

function u8ToBase64(arr: Uint8Array): string {
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return globalThis.btoa
    ? globalThis.btoa(s)
    : Buffer.from(arr).toString("base64");
}

function base64ToU8(b64: string): Uint8Array {
  const bin = globalThis.atob
    ? globalThis.atob(b64)
    : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function readMMKV(key: string): InternalEntry | null {
  const raw = qrStore.getString(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedMatrix;
    return { size: parsed.size, data: base64ToU8(parsed.data) };
  } catch {
    return null;
  }
}

function writeMMKV(key: string, entry: InternalEntry): void {
  const payload: CachedMatrix = {
    size: entry.size,
    data: u8ToBase64(entry.data),
  };
  try {
    qrStore.set(key, JSON.stringify(payload));
  } catch {
    // Non-fatal: memCache keeps the session fast even if persistence fails.
  }
}

// The library's adapter reads only `.modules.size` and `.modules.data`
// from what `QRC.create` returns. Full QRCode instances are never
// consulted by the render path, so a thin stub is sufficient.
function stubFromCache(entry: InternalEntry) {
  return { modules: { size: entry.size, data: entry.data } };
}

let installed = false;
let originalCreate: typeof QRC.create | null = null;

/**
 * Monkey-patches `qrcode.create` with a content-addressed cache
 * (in-memory Map + MMKV). The upstream `react-native-qrcode-styled`
 * component doesn't expose a `bitMatrix` prop and its `exports` field
 * hides the internal SVG pieces — patching `QRC.create` is the
 * smallest-surface intercept that eliminates the Reed-Solomon /
 * mask-pattern compute on cache hits without forking the library.
 *
 * Idempotent. Call once at app bootstrap, before any render.
 */
export function installQRMatrixCache(): void {
  if (installed) return;
  installed = true;
  originalCreate = QRC.create.bind(QRC);
  QRC.create = function cachedCreate(message: unknown, options: unknown) {
    const key = cacheKey(message, options);
    if (key) {
      const hot = memCache.get(key);
      if (hot) return stubFromCache(hot);
      const cold = readMMKV(key);
      if (cold) {
        memCache.set(key, cold);
        return stubFromCache(cold);
      }
    }
    const real = originalCreate!(message as never, options as never);
    if (key) {
      const mods = (real as { modules?: { size: number; data: Uint8Array } })
        .modules;
      if (mods?.data) {
        // Defensive copy — downstream may mutate; we don't want that
        // poisoning the cache.
        const entry: InternalEntry = {
          size: mods.size,
          data: new Uint8Array(mods.data),
        };
        memCache.set(key, entry);
        writeMMKV(key, entry);
      }
    }
    return real;
  } as typeof QRC.create;
}

/**
 * Warm the cache for a payload without rendering. Synchronous (MMKV +
 * qrcode are both sync). Safe to fire from `requestIdleCallback`.
 */
export function prefetchQRMatrix(
  message: string,
  options?: Parameters<typeof QRC.create>[1],
): void {
  if (!installed) return;
  const key = cacheKey(message, options);
  if (!key) return;
  if (memCache.has(key)) return;
  const cold = readMMKV(key);
  if (cold) {
    memCache.set(key, cold);
    return;
  }
  QRC.create(message, options);
}

/**
 * Synchronous hit check — lets UI decide between "render now" (cached)
 * vs "wait for modal animation" (uncached first-seen address).
 */
export function isQRMatrixCached(
  message: string,
  options?: Parameters<typeof QRC.create>[1],
): boolean {
  const key = cacheKey(message, options);
  if (!key) return false;
  if (memCache.has(key)) return true;
  const cold = readMMKV(key);
  if (cold) {
    memCache.set(key, cold);
    return true;
  }
  return false;
}

export function clearQRMatrixCache(): void {
  memCache.clear();
  try {
    qrStore.clearAll();
  } catch {
    // noop
  }
}
