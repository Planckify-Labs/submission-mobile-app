/**
 * WalletConnect session persistence via expo-sqlite.
 */

import * as SQLite from "expo-sqlite";

export interface WCSession {
  topic: string;
  peerName: string;
  peerUrl: string;
  peerIcon?: string;
  chains: string[];
  methods: string[];
  accounts: string[];
  expiry: number;
  connectedAt: number;
}

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync("walletconnect.db");
    db.execSync(
      "CREATE TABLE IF NOT EXISTS sessions (" +
        "topic TEXT PRIMARY KEY, peer_name TEXT NOT NULL, peer_url TEXT NOT NULL, " +
        "peer_icon TEXT, chains TEXT NOT NULL, methods TEXT NOT NULL, " +
        "accounts TEXT NOT NULL, expiry INTEGER NOT NULL, connected_at INTEGER NOT NULL" +
        ");"
    );
  }
  return db;
}

export function saveSession(session: WCSession): void {
  const database = getDb();
  database.runSync(
    "INSERT OR REPLACE INTO sessions (topic, peer_name, peer_url, peer_icon, chains, methods, accounts, expiry, connected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [session.topic, session.peerName, session.peerUrl, session.peerIcon ?? null,
     JSON.stringify(session.chains), JSON.stringify(session.methods),
     JSON.stringify(session.accounts), session.expiry, session.connectedAt],
  );
}

export function getSessions(): WCSession[] {
  const database = getDb();
  const rows = database.getAllSync<Record<string, unknown>>(
    "SELECT * FROM sessions WHERE expiry > ? ORDER BY connected_at DESC",
    [Math.floor(Date.now() / 1000)],
  );
  return rows.map(rowToSession);
}

export function deleteSession(topic: string): void {
  const database = getDb();
  database.runSync("DELETE FROM sessions WHERE topic = ?", [topic]);
}

export function clearExpiredSessions(): void {
  const database = getDb();
  database.runSync("DELETE FROM sessions WHERE expiry <= ?", [Math.floor(Date.now() / 1000)]);
}

function rowToSession(row: Record<string, unknown>): WCSession {
  return {
    topic: row.topic as string, peerName: row.peer_name as string,
    peerUrl: row.peer_url as string, peerIcon: (row.peer_icon as string) ?? undefined,
    chains: JSON.parse(row.chains as string), methods: JSON.parse(row.methods as string),
    accounts: JSON.parse(row.accounts as string),
    expiry: row.expiry as number, connectedAt: row.connected_at as number,
  };
}
