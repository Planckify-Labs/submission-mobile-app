/**
 * L2 withdrawal tracking for Optimistic rollups.
 */

import * as SQLite from "expo-sqlite";

export type WithdrawalStatus =
  | "pending"
  | "challenge-period"
  | "ready-to-finalize"
  | "finalized";

export interface TrackedWithdrawal {
  hash: string;
  chainId: number;
  l1ChainId: number;
  from: string;
  value: string;
  status: WithdrawalStatus;
  submittedAt: number;
  challengeEndAt?: number;
  finalizedAt?: number;
}

const CHALLENGE_PERIODS: Record<number, number> = {
  10: 7 * 86_400_000,
  8453: 7 * 86_400_000,
  42161: 7 * 86_400_000,
};

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync("l2_withdrawals.db");
    db.execSync(
      "CREATE TABLE IF NOT EXISTS withdrawals (" +
        "hash TEXT PRIMARY KEY, chain_id INTEGER NOT NULL, l1_chain_id INTEGER NOT NULL, " +
        "from_addr TEXT NOT NULL, value TEXT NOT NULL, status TEXT NOT NULL, " +
        "submitted_at INTEGER NOT NULL, challenge_end_at INTEGER, finalized_at INTEGER" +
        ");",
    );
  }
  return db;
}

export function trackWithdrawal(
  w: Omit<TrackedWithdrawal, "status" | "challengeEndAt">,
): void {
  const database = getDb();
  const period = CHALLENGE_PERIODS[w.chainId] ?? 7 * 86_400_000;
  const challengeEndAt = w.submittedAt + period;
  database.runSync(
    "INSERT OR REPLACE INTO withdrawals (hash, chain_id, l1_chain_id, from_addr, value, status, submitted_at, challenge_end_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      w.hash,
      w.chainId,
      w.l1ChainId,
      w.from,
      w.value,
      "pending",
      w.submittedAt,
      challengeEndAt,
    ],
  );
}

export function getActiveWithdrawals(): TrackedWithdrawal[] {
  const database = getDb();
  const rows = database.getAllSync<Record<string, unknown>>(
    "SELECT * FROM withdrawals WHERE status != 'finalized' ORDER BY submitted_at DESC",
  );
  return rows.map(rowToWithdrawal).map(updateStatus);
}

export function getWithdrawalCountdown(w: TrackedWithdrawal): string {
  if (!w.challengeEndAt) return "Unknown";
  const remaining = w.challengeEndAt - Date.now();
  if (remaining <= 0) return "Ready to finalize";
  const d = Math.floor(remaining / 86_400_000);
  const h = Math.floor((remaining % 86_400_000) / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  if (d > 0) return `~${d}d ${h}h ${m}m`;
  if (h > 0) return `~${h}h ${m}m`;
  return `~${m}m`;
}

function updateStatus(w: TrackedWithdrawal): TrackedWithdrawal {
  if (w.status === "finalized") return w;
  if (w.challengeEndAt && Date.now() >= w.challengeEndAt) {
    w.status = "ready-to-finalize";
    const database = getDb();
    database.runSync("UPDATE withdrawals SET status = ? WHERE hash = ?", [
      "ready-to-finalize",
      w.hash,
    ]);
  } else if (w.challengeEndAt) {
    w.status = "challenge-period";
  }
  return w;
}

function rowToWithdrawal(row: Record<string, unknown>): TrackedWithdrawal {
  return {
    hash: row.hash as string,
    chainId: row.chain_id as number,
    l1ChainId: row.l1_chain_id as number,
    from: row.from_addr as string,
    value: row.value as string,
    status: row.status as WithdrawalStatus,
    submittedAt: row.submitted_at as number,
    challengeEndAt: (row.challenge_end_at as number) ?? undefined,
    finalizedAt: (row.finalized_at as number) ?? undefined,
  };
}
