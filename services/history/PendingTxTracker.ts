/**
 * Pending transaction tracker with exponential backoff polling,
 * speed-up/cancel support, and SQLite persistence.
 */

import * as SQLite from "expo-sqlite";
import { getPublicClient } from "@/utils/clients";
import { supportedChains } from "@/constants/configs/chainConfig";
import type { TxStatus } from "@/services/indexer/types";

// ─── Types ───────────────────────────────────────────────────────────

export interface PendingTx {
  hash: string;
  chainId: number;
  from: string;
  to: string | null;
  nonce: number;
  value: string; // bigint serialized as string
  data: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
  status: TxStatus;
  submittedAt: number;
  confirmedAt?: number;
  description?: string;
  replacedBy?: string;
  replacementFor?: string;
}

export type PendingTxListener = (tx: PendingTx, event: "confirmed" | "failed" | "dropped") => void;

// ─── Backoff intervals (ms) ──────────────────────────────────────────

const BACKOFF_INTERVALS = [2000, 4000, 8000, 15000, 30000];
const DROP_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// ─── Tracker ─────────────────────────────────────────────────────────

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync("pending_txs.db");
    db.execSync(
      "CREATE TABLE IF NOT EXISTS pending_txs (" +
        "hash TEXT PRIMARY KEY, " +
        "chain_id INTEGER NOT NULL, " +
        "from_addr TEXT NOT NULL, " +
        "to_addr TEXT, " +
        "nonce INTEGER NOT NULL, " +
        "value TEXT NOT NULL, " +
        "data TEXT NOT NULL, " +
        "max_fee TEXT, " +
        "max_priority_fee TEXT, " +
        "gas_price TEXT, " +
        "status TEXT NOT NULL, " +
        "submitted_at INTEGER NOT NULL, " +
        "confirmed_at INTEGER, " +
        "description TEXT, " +
        "replaced_by TEXT, " +
        "replacement_for TEXT" +
        ");"
    );
  }
  return db;
}

const listeners = new Set<PendingTxListener>();
const pollingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function addListener(listener: PendingTxListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(tx: PendingTx, event: "confirmed" | "failed" | "dropped") {
  for (const listener of listeners) {
    listener(tx, event);
  }
}

export function registerPendingTx(tx: PendingTx): void {
  const database = getDb();
  database.runSync(
    "INSERT OR REPLACE INTO pending_txs " +
      "(hash, chain_id, from_addr, to_addr, nonce, value, data, max_fee, max_priority_fee, gas_price, status, submitted_at, description, replaced_by, replacement_for) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      tx.hash, tx.chainId, tx.from, tx.to, tx.nonce, tx.value, tx.data,
      tx.maxFeePerGas ?? null, tx.maxPriorityFeePerGas ?? null, tx.gasPrice ?? null,
      tx.status, tx.submittedAt, tx.description ?? null,
      tx.replacedBy ?? null, tx.replacementFor ?? null,
    ],
  );

  startPolling(tx);
}

export function getPendingTxs(): PendingTx[] {
  const database = getDb();
  const rows = database.getAllSync<Record<string, unknown>>(
    "SELECT * FROM pending_txs WHERE status = 'pending' ORDER BY submitted_at DESC",
  );
  return rows.map(rowToTx);
}

export function getAllTrackedTxs(): PendingTx[] {
  const database = getDb();
  const rows = database.getAllSync<Record<string, unknown>>(
    "SELECT * FROM pending_txs ORDER BY submitted_at DESC LIMIT 100",
  );
  return rows.map(rowToTx);
}

function updateStatus(hash: string, status: TxStatus, confirmedAt?: number): void {
  const database = getDb();
  database.runSync(
    "UPDATE pending_txs SET status = ?, confirmed_at = ? WHERE hash = ?",
    [status, confirmedAt ?? null, hash],
  );
}

function startPolling(tx: PendingTx, attempt = 0): void {
  if (pollingTimers.has(tx.hash)) return;

  const chain = supportedChains.find((c) => c.chain.id === tx.chainId)?.chain;
  if (!chain) return;

  const client = getPublicClient(chain);
  const delay = BACKOFF_INTERVALS[Math.min(attempt, BACKOFF_INTERVALS.length - 1)];

  const timer = setTimeout(async () => {
    pollingTimers.delete(tx.hash);

    try {
      const receipt = await client.getTransactionReceipt({ hash: tx.hash as `0x${string}` });

      if (receipt) {
        const status: TxStatus = receipt.status === "success" ? "confirmed" : "failed";
        updateStatus(tx.hash, status, Date.now());
        tx.status = status;
        notify(tx, status === "confirmed" ? "confirmed" : "failed");
        return;
      }
    } catch {
      // Receipt not found yet
    }

    // Check for drop timeout
    if (Date.now() - tx.submittedAt > DROP_TIMEOUT) {
      updateStatus(tx.hash, "dropped");
      tx.status = "dropped";
      notify(tx, "dropped");
      return;
    }

    startPolling(tx, attempt + 1);
  }, delay);

  pollingTimers.set(tx.hash, timer);
}

export function resumeTracking(): void {
  const pending = getPendingTxs();
  for (const tx of pending) {
    startPolling(tx);
  }
}

export function stopTracking(): void {
  for (const timer of pollingTimers.values()) {
    clearTimeout(timer);
  }
  pollingTimers.clear();
}

// ─── Speed-up / Cancel helpers ───────────────────────────────────────

export function buildSpeedUpParams(tx: PendingTx) {
  const bumpFactor = 1.2;
  const originalMaxFee = BigInt(tx.maxFeePerGas ?? tx.gasPrice ?? "0");
  const originalPriorityFee = BigInt(tx.maxPriorityFeePerGas ?? "0");

  return {
    to: tx.to ?? tx.from,
    value: tx.value,
    data: tx.data,
    nonce: tx.nonce,
    maxFeePerGas: BigInt(Math.ceil(Number(originalMaxFee) * bumpFactor)),
    maxPriorityFeePerGas: BigInt(Math.ceil(Number(originalPriorityFee) * bumpFactor)),
  };
}

export function buildCancelParams(tx: PendingTx) {
  const bumpFactor = 1.2;
  const originalMaxFee = BigInt(tx.maxFeePerGas ?? tx.gasPrice ?? "0");
  const originalPriorityFee = BigInt(tx.maxPriorityFeePerGas ?? "0");

  return {
    to: tx.from,
    value: "0",
    data: "0x",
    nonce: tx.nonce,
    maxFeePerGas: BigInt(Math.ceil(Number(originalMaxFee) * bumpFactor)),
    maxPriorityFeePerGas: BigInt(Math.ceil(Number(originalPriorityFee) * bumpFactor)),
  };
}

function rowToTx(row: Record<string, unknown>): PendingTx {
  return {
    hash: row.hash as string,
    chainId: row.chain_id as number,
    from: row.from_addr as string,
    to: row.to_addr as string | null,
    nonce: row.nonce as number,
    value: row.value as string,
    data: row.data as string,
    maxFeePerGas: (row.max_fee as string) ?? undefined,
    maxPriorityFeePerGas: (row.max_priority_fee as string) ?? undefined,
    gasPrice: (row.gas_price as string) ?? undefined,
    status: row.status as TxStatus,
    submittedAt: row.submitted_at as number,
    confirmedAt: (row.confirmed_at as number) ?? undefined,
    description: (row.description as string) ?? undefined,
    replacedBy: (row.replaced_by as string) ?? undefined,
    replacementFor: (row.replacement_for as string) ?? undefined,
  };
}
