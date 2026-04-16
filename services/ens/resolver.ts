/**
 * ENS forward + reverse resolution + avatar + CCIP-read.
 * Uses viem's built-in ENS support (includes CCIP-read natively).
 * Cache in expo-sqlite with 24h TTL.
 */

import * as SQLite from "expo-sqlite";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import type { ENSResolution } from "@/services/indexer/types";
import { getPublicClient } from "@/utils/clients";

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync("ens_cache.db");
    db.execSync(
      "CREATE TABLE IF NOT EXISTS ens_cache (" +
        "key TEXT PRIMARY KEY, " +
        "name TEXT, " +
        "address TEXT, " +
        "avatar TEXT, " +
        "text_records TEXT, " +
        "contenthash TEXT, " +
        "cached_at INTEGER NOT NULL" +
        ");",
    );
  }
  return db;
}

const ENS_TTL = 86_400_000;

function getCached(key: string): ENSResolution | null {
  const database = getDb();
  const row = database.getFirstSync<{
    name: string | null;
    address: string | null;
    avatar: string | null;
    text_records: string | null;
    contenthash: string | null;
    cached_at: number;
  }>("SELECT * FROM ens_cache WHERE key = ?", [key]);

  if (!row || Date.now() - row.cached_at > ENS_TTL) return null;

  return {
    name: row.name,
    address: row.address,
    avatar: row.avatar ?? undefined,
    textRecords: row.text_records ? JSON.parse(row.text_records) : undefined,
    contenthash: row.contenthash ?? undefined,
    chainId: 1,
  };
}

function setCache(key: string, resolution: ENSResolution): void {
  const database = getDb();
  database.runSync(
    "INSERT OR REPLACE INTO ens_cache (key, name, address, avatar, text_records, contenthash, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      key,
      resolution.name,
      resolution.address,
      resolution.avatar ?? null,
      resolution.textRecords ? JSON.stringify(resolution.textRecords) : null,
      resolution.contenthash ?? null,
      Date.now(),
    ],
  );
}

export async function resolveForward(
  name: string,
): Promise<ENSResolution | null> {
  if (!name || !name.includes(".")) return null;

  const cacheKey = `forward:${name.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const client = getPublicClient(mainnet);
    const normalizedName = normalize(name);
    const address = await client.getEnsAddress({ name: normalizedName });
    if (!address) return null;

    const resolution: ENSResolution = {
      name: normalizedName,
      address,
      chainId: 1,
    };
    setCache(cacheKey, resolution);
    return resolution;
  } catch {
    return null;
  }
}

export async function resolveReverse(
  address: string,
): Promise<ENSResolution | null> {
  if (!address || !address.startsWith("0x")) return null;

  const cacheKey = `reverse:${address.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const client = getPublicClient(mainnet);
    const name = await client.getEnsName({ address: address as `0x${string}` });
    if (!name) return null;

    const resolution: ENSResolution = { name, address, chainId: 1 };
    setCache(cacheKey, resolution);
    return resolution;
  } catch {
    return null;
  }
}

export async function resolveAvatar(name: string): Promise<string | null> {
  if (!name) return null;

  const cacheKey = `avatar:${name.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached?.avatar) return cached.avatar;

  try {
    const client = getPublicClient(mainnet);
    const normalizedName = normalize(name);
    const avatar = await client.getEnsAvatar({ name: normalizedName });
    if (avatar) setCache(cacheKey, { name, address: null, avatar, chainId: 1 });
    return avatar;
  } catch {
    return null;
  }
}

export async function resolveTextRecords(
  name: string,
  keys: string[],
): Promise<Record<string, string>> {
  const client = getPublicClient(mainnet);
  const records: Record<string, string> = {};
  try {
    const normalizedName = normalize(name);
    for (const key of keys) {
      try {
        const value = await client.getEnsText({ name: normalizedName, key });
        if (value) records[key] = value;
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }
  return records;
}
