/**
 * Price feed aggregation and portfolio total computation.
 */

import * as SQLite from "expo-sqlite";
import { formatUnits } from "viem";
import { getCached, setCache } from "@/services/indexer/cache";
import { indexerRegistry } from "@/services/indexer/registry";
import type { TokenPrice } from "@/services/indexer/types";

// ─── Currency preferences ────────────────────────────────────────────

let prefsDb: SQLite.SQLiteDatabase | null = null;

function getPrefsDb(): SQLite.SQLiteDatabase {
  if (!prefsDb) {
    prefsDb = SQLite.openDatabaseSync("currency_prefs.db");
    prefsDb.execSync(
      "CREATE TABLE IF NOT EXISTS settings (" +
        "key TEXT PRIMARY KEY, " +
        "value TEXT NOT NULL" +
        ");",
    );
  }
  return prefsDb;
}

export type FiatCurrency =
  | "USD"
  | "EUR"
  | "GBP"
  | "JPY"
  | "IDR"
  | "KRW"
  | "CNY";

export function getCurrencyPreference(): FiatCurrency {
  const db = getPrefsDb();
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    ["fiat_currency"],
  );
  return (row?.value as FiatCurrency) ?? "USD";
}

export function setCurrencyPreference(currency: FiatCurrency): void {
  const db = getPrefsDb();
  db.runSync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [
    "fiat_currency",
    currency,
  ]);
}

// ─── Exchange rates (simple static fallback) ─────────────────────────

const EXCHANGE_RATES: Record<FiatCurrency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 154.5,
  IDR: 15850,
  KRW: 1380,
  CNY: 7.24,
};

export function getExchangeRate(currency: FiatCurrency): number {
  return EXCHANGE_RATES[currency] ?? 1;
}

// ─── Portfolio computation ───────────────────────────────────────────

export interface PortfolioSummary {
  totalValueUsd: number;
  totalValueLocal: number;
  change24hPercent: number;
  change24hUsd: number;
  currency: FiatCurrency;
  exchangeRate: number;
}

export function computePortfolioTotal(
  balances: Array<{
    balance: bigint;
    decimals: number;
    price?: number;
    change24h?: number;
    isHidden?: boolean;
  }>,
  currency: FiatCurrency = "USD",
): PortfolioSummary {
  let totalValueUsd = 0;
  let previousTotalUsd = 0;

  for (const token of balances) {
    if (token.isHidden) continue;
    if (!token.price) continue;

    const amount = parseFloat(formatUnits(token.balance, token.decimals));
    const value = amount * token.price;
    totalValueUsd += value;

    const change = token.change24h ?? 0;
    const previousPrice = token.price / (1 + change / 100);
    previousTotalUsd += amount * previousPrice;
  }

  const change24hUsd = totalValueUsd - previousTotalUsd;
  const change24hPercent =
    previousTotalUsd > 0 ? (change24hUsd / previousTotalUsd) * 100 : 0;
  const exchangeRate = getExchangeRate(currency);

  return {
    totalValueUsd,
    totalValueLocal: totalValueUsd * exchangeRate,
    change24hPercent,
    change24hUsd,
    currency,
    exchangeRate,
  };
}

// ─── Fetch prices ────────────────────────────────────────────────────

export async function fetchTokenPrices(
  contractAddresses: string[],
  chainId: number,
): Promise<TokenPrice[]> {
  if (contractAddresses.length === 0) return [];

  const cacheKey = contractAddresses.sort().join(",");
  const cached = getCached<TokenPrice[]>("prices", cacheKey, chainId);

  try {
    const prices = await indexerRegistry.call<TokenPrice[]>(
      "getTokenPrices",
      contractAddresses,
      chainId,
    );
    setCache("prices", prices, cacheKey, chainId);
    return prices;
  } catch {
    return cached?.data ?? [];
  }
}
