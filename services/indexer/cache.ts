/**
 * SQLite-backed cache for indexer data with per-type TTLs.
 * Returns stale data with a `stale: true` flag when network is unavailable.
 */

import * as SQLite from "expo-sqlite";

// ─── TTL Configuration (milliseconds) ────────────────────────────────

const TTL = {
  tokenBalances: 30_000,
  prices: 60_000,
  transactionHistory: 120_000,
  nftMetadata: 86_400_000, // 24h
  ensResolution: 86_400_000, // 24h
  tokenApprovals: 60_000,
  tokenMetadata: 86_400_000,
} as const;

export type CacheCategory = keyof typeof TTL;

// ─── Cache Result ────────────────────────────────────────────────────

export interface CacheResult<T> {
  data: T;
  stale: boolean;
}

// ─── Cache Implementation ────────────────────────────────────────────

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync("indexer_cache.db");
    db.execSync(
      "CREATE TABLE IF NOT EXISTS cache (" +
        "key TEXT PRIMARY KEY, " +
        "category TEXT NOT NULL, " +
        "data TEXT NOT NULL, " +
        "updated_at INTEGER NOT NULL" +
        ");",
    );
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_cache_category ON cache(category);",
    );
  }
  return db;
}

function cacheKey(
  category: CacheCategory,
  ...parts: (string | number)[]
): string {
  return `${category}:${parts.join(":")}`;
}

/**
 * Retrieve cached data. Returns null if nothing cached.
 * If data exists but is past TTL, returns it with `stale: true`.
 */
export function getCached<T>(
  category: CacheCategory,
  ...keyParts: (string | number)[]
): CacheResult<T> | null {
  const key = cacheKey(category, ...keyParts);
  const database = getDb();

  const row = database.getFirstSync<{ data: string; updated_at: number }>(
    "SELECT data, updated_at FROM cache WHERE key = ?",
    [key],
  );

  if (!row) return null;

  const ttl = TTL[category];
  const age = Date.now() - row.updated_at;
  const stale = age > ttl;

  try {
    const data = JSON.parse(row.data, bigIntReviver) as T;
    return { data, stale };
  } catch {
    return null;
  }
}

/**
 * Store data in cache.
 */
export function setCache<T>(
  category: CacheCategory,
  data: T,
  ...keyParts: (string | number)[]
): void {
  const key = cacheKey(category, ...keyParts);
  const database = getDb();
  const serialized = JSON.stringify(data, bigIntReplacer);

  database.runSync(
    "INSERT OR REPLACE INTO cache (key, category, data, updated_at) VALUES (?, ?, ?, ?)",
    [key, category, serialized, Date.now()],
  );
}

/**
 * Clear all entries for a category.
 */
export function clearCategory(category: CacheCategory): void {
  const database = getDb();
  database.runSync("DELETE FROM cache WHERE category = ?", [category]);
}

/**
 * Clear expired entries across all categories.
 */
export function pruneExpired(): void {
  const database = getDb();
  const now = Date.now();

  for (const [category, ttl] of Object.entries(TTL)) {
    database.runSync(
      "DELETE FROM cache WHERE category = ? AND updated_at < ?",
      [category, now - ttl * 10], // prune entries 10x past TTL
    );
  }
}

// ─── BigInt JSON helpers ─────────────────────────────────────────────

function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return { __type: "bigint", value: value.toString() };
  }
  return value;
}

function bigIntReviver(_key: string, value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    (value as Record<string, unknown>).__type === "bigint"
  ) {
    return BigInt((value as Record<string, string>).value);
  }
  return value;
}
