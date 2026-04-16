/**
 * Honeypot detection via simulate approve + transferFrom.
 * Runs only for discovered tokens, cached for 7 days.
 */

import * as SQLite from "expo-sqlite";
import { erc20Abi, getAddress } from "viem";
import { supportedChains } from "@/constants/configs/chainConfig";
import { getPublicClient } from "@/utils/clients";

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync("honeypot.db");
    db.execSync(
      "CREATE TABLE IF NOT EXISTS honeypot_cache (" +
        "contract_address TEXT NOT NULL, " +
        "chain_id INTEGER NOT NULL, " +
        "is_honeypot INTEGER NOT NULL, " +
        "reason TEXT, " +
        "checked_at INTEGER NOT NULL, " +
        "PRIMARY KEY (contract_address, chain_id)" +
        ");",
    );
  }
  return db;
}

export interface HoneypotResult {
  isHoneypot: boolean;
  reason?: string;
}

export function getCachedResult(
  contractAddress: string,
  chainId: number,
): HoneypotResult | null {
  const database = getDb();
  const row = database.getFirstSync<{
    is_honeypot: number;
    reason: string | null;
    checked_at: number;
  }>(
    "SELECT * FROM honeypot_cache WHERE contract_address = ? AND chain_id = ?",
    [contractAddress.toLowerCase(), chainId],
  );
  if (!row || Date.now() - row.checked_at > 7 * 86_400_000) return null;
  return { isHoneypot: row.is_honeypot === 1, reason: row.reason ?? undefined };
}

export async function detectHoneypot(
  contractAddress: string,
  chainId: number,
  ownerAddress: string,
): Promise<HoneypotResult> {
  const cached = getCachedResult(contractAddress, chainId);
  if (cached) return cached;

  const chain = supportedChains.find((c) => c.chain.id === chainId)?.chain;
  if (!chain) return { isHoneypot: false };

  const client = getPublicClient(chain);
  const tokenAddr = getAddress(contractAddress);
  const owner = getAddress(ownerAddress);
  const spender = getAddress("0x000000000000000000000000000000000000dEaD");

  let result: HoneypotResult = { isHoneypot: false };

  try {
    await client.simulateContract({
      address: tokenAddr,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, BigInt("1000000")],
      account: owner,
    });
    await client.simulateContract({
      address: tokenAddr,
      abi: erc20Abi,
      functionName: "transfer",
      args: [spender, 1n],
      account: owner,
    });
  } catch {
    result = {
      isHoneypot: true,
      reason: "Cannot be transferred — possible honeypot",
    };
  }

  const database = getDb();
  database.runSync(
    "INSERT OR REPLACE INTO honeypot_cache (contract_address, chain_id, is_honeypot, reason, checked_at) VALUES (?, ?, ?, ?, ?)",
    [
      contractAddress.toLowerCase(),
      chainId,
      result.isHoneypot ? 1 : 0,
      result.reason ?? null,
      Date.now(),
    ],
  );

  return result;
}
